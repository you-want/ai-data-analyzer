import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { BillingLedger } from './entities/billing-ledger.entity';
import { Subscription, type BillingPlan } from './entities/subscription.entity';
import { TenantRlsService } from '../tenant/tenant-rls.service';

interface StripeCheckoutSession {
  id: string;
  url?: string | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  metadata?: Record<string, string>;
  client_reference_id?: string | null;
}

interface StripeSubscriptionObject {
  id: string;
  customer?: string | { id?: string } | null;
  status: string;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      current_period_end?: number;
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
}

interface StripeWebhookEvent {
  type: string;
  data: {
    object: unknown;
  };
}

interface StripeClient {
  checkout: {
    sessions: {
      create(input: Record<string, unknown>): Promise<StripeCheckoutSession>;
    };
  };
  webhooks: {
    constructEvent(
      rawBody: Buffer,
      signature: string,
      secret: string,
    ): StripeWebhookEvent;
  };
  customers: {
    create(input: Record<string, unknown>): Promise<{ id: string }>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeConstructor = require('stripe') as {
  new (
    apiKey: string,
    config: {
      apiVersion: string;
    },
  ): StripeClient;
};

const PLAN_LIMITS: Record<
  BillingPlan,
  {
    monthlyTokens: number;
    monthlyRequests: number;
    concurrentJobs: number;
    requestsPerMinute: number;
  }
> = {
  free: {
    monthlyTokens: 150000,
    monthlyRequests: 100,
    concurrentJobs: 1,
    requestsPerMinute: 5,
  },
  pro: {
    monthlyTokens: 1500000,
    monthlyRequests: 1000,
    concurrentJobs: 3,
    requestsPerMinute: 30,
  },
  team: {
    monthlyTokens: 10000000,
    monthlyRequests: 10000,
    concurrentJobs: 10,
    requestsPerMinute: 120,
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: StripeClient | null;

  constructor(
    @InjectRepository(BillingLedger)
    private readonly ledgerRepository: Repository<BillingLedger>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly tenantRlsService: TenantRlsService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = stripeSecretKey
      ? new StripeConstructor(stripeSecretKey, {
          apiVersion: '2026-05-27.dahlia',
        })
      : null;
  }

  async ensureSubscription(workspaceId: string): Promise<Subscription> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) =>
        this.ensureSubscriptionWithManager(manager, workspaceId),
    );
  }

  async getUsageSummary(workspaceId: string) {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const subscription = await this.ensureSubscriptionWithManager(
          manager,
          workspaceId,
        );
        const limits = PLAN_LIMITS[subscription.plan];
        const currentMonthStart = new Date();
        currentMonthStart.setUTCDate(1);
        currentMonthStart.setUTCHours(0, 0, 0, 0);

        const ledger = await manager.getRepository(BillingLedger).find({
          where: { workspaceId },
          order: { createdAt: 'DESC' },
          take: 500,
        });

        const currentMonthEntries = ledger.filter(
          (entry) => entry.createdAt >= currentMonthStart,
        );

        const totals = currentMonthEntries.reduce(
          (accumulator, entry) => {
            const tokens = Number(entry.units.tokens ?? 0);
            accumulator.tokens += tokens;
            accumulator.requests += 1;
            accumulator.execSeconds +=
              Number(entry.units.durationMs ?? 0) / 1000;
            return accumulator;
          },
          { tokens: 0, requests: 0, execSeconds: 0 },
        );

        return {
          subscription,
          limits,
          usage: totals,
        };
      },
    );
  }

  async recordUsage(input: {
    workspaceId: string;
    userId?: string;
    eventType: 'llm' | 'exec' | 'storage';
    eventKey: string;
    units: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<BillingLedger> {
    return this.tenantRlsService.runWithTenant(
      {
        workspaceId: input.workspaceId,
        userId: input.userId,
      },
      async (manager) => {
        const ledgerRepository = manager.getRepository(BillingLedger);
        const existing = await ledgerRepository.findOne({
          where: { workspaceId: input.workspaceId, eventKey: input.eventKey },
        });

        if (existing) {
          return existing;
        }

        return ledgerRepository.save(
          ledgerRepository.create({
            workspaceId: input.workspaceId,
            userId: input.userId,
            eventType: input.eventType,
            eventKey: input.eventKey,
            units: input.units,
            metadata: input.metadata ?? {},
          }),
        );
      },
    );
  }

  async guardAnalysisAccess(input: {
    workspaceId: string;
    userId?: string;
    route: string;
  }): Promise<void> {
    const usage = await this.getUsageSummary(input.workspaceId);
    const limits = usage.limits;

    if (usage.usage.requests >= limits.monthlyRequests) {
      throw new UnprocessableEntityException(
        '本月分析请求额度已用完，升级套餐后我们继续快乐分析。',
      );
    }

    if (usage.usage.tokens >= limits.monthlyTokens) {
      throw new UnprocessableEntityException(
        '本月 Token 额度已见底，请升级套餐或下个月再来。',
      );
    }

    await this.consumeRateLimit(
      `rl:${input.workspaceId}:${input.userId ?? 'anonymous'}:${input.route}`,
      limits.requestsPerMinute,
      60,
    );

    await this.guardConcurrentJobs(input.workspaceId, limits.concurrentJobs);
  }

  async startJob(workspaceId: string): Promise<void> {
    const key = `quota:${workspaceId}:running-jobs`;
    const running = Number((await this.cacheManager.get<number>(key)) ?? 0);
    await this.cacheManager.set(key, running + 1, 60 * 60 * 1000);
  }

  async finishJob(workspaceId: string): Promise<void> {
    const key = `quota:${workspaceId}:running-jobs`;
    const running = Number((await this.cacheManager.get<number>(key)) ?? 0);
    await this.cacheManager.set(key, Math.max(0, running - 1), 60 * 60 * 1000);
  }

  async createCheckoutSession(input: {
    workspaceId: string;
    plan: Exclude<BillingPlan, 'free'>;
    successUrl: string;
    cancelUrl: string;
  }) {
    const baseUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    if (this.stripe) {
      const subscription = await this.ensureSubscription(input.workspaceId);
      const customerId = await this.ensureStripeCustomer(input.workspaceId);
      const priceId = this.getStripePriceId(input.plan);
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: input.workspaceId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          workspaceId: input.workspaceId,
          plan: input.plan,
          subscriptionId: subscription.id,
        },
      });

      return {
        mode: 'stripe',
        workspaceId: input.workspaceId,
        checkoutUrl: session.url,
        sessionId: session.id,
        customerId,
      };
    }

    return {
      mode: 'stub',
      workspaceId: input.workspaceId,
      checkoutUrl: `${baseUrl}/billing/checkout?plan=${input.plan}&workspaceId=${input.workspaceId}`,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      message:
        '当前仓库版保留了支付状态机和 Webhook 同步接口，Checkout URL 使用可替换的占位地址，方便本地联调。',
    };
  }

  async syncSubscriptionFromWebhook(payload: {
    workspaceId: string;
    plan: BillingPlan;
    status: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
  }): Promise<Subscription> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId: payload.workspaceId },
      async (manager) => {
        const subscription = await this.ensureSubscriptionWithManager(
          manager,
          payload.workspaceId,
        );
        subscription.plan = payload.plan;
        subscription.status = payload.status;
        subscription.stripeCustomerId = payload.stripeCustomerId ?? null;
        subscription.stripeSubscriptionId =
          payload.stripeSubscriptionId ?? null;
        subscription.currentPeriodEnd = payload.currentPeriodEnd
          ? new Date(payload.currentPeriodEnd)
          : null;

        return manager.getRepository(Subscription).save(subscription);
      },
    );
  }

  async handleWebhook(input: {
    rawBody?: Buffer;
    stripeSignature?: string;
    fallbackSecret?: string;
    payload: {
      workspaceId: string;
      plan: BillingPlan;
      status: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      currentPeriodEnd?: string;
    };
  }): Promise<Subscription> {
    const stripeWebhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (this.stripe && stripeWebhookSecret) {
      if (!input.rawBody || !input.stripeSignature) {
        throw new HttpException(
          '缺少 Stripe Webhook 签名或原始报文',
          HttpStatus.BAD_REQUEST,
        );
      }

      const event = this.stripe.webhooks.constructEvent(
        input.rawBody,
        input.stripeSignature,
        stripeWebhookSecret,
      );
      return this.syncSubscriptionFromStripeEvent(event);
    }

    const expectedSecret = this.configService.get<string>(
      'BILLING_WEBHOOK_SECRET',
    );
    if (expectedSecret && input.fallbackSecret !== expectedSecret) {
      throw new HttpException('Webhook secret 不正确', HttpStatus.UNAUTHORIZED);
    }

    return this.syncSubscriptionFromWebhook(input.payload);
  }

  private async consumeRateLimit(
    key: string,
    limit: number,
    ttlSeconds: number,
  ): Promise<void> {
    const cached = await this.cacheManager.get<{ count: number }>(key);
    const count = (cached?.count ?? 0) + 1;

    if (count > limit) {
      throw new HttpException(
        '请求太快了，AI 也要喘口气。',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cacheManager.set(key, { count }, ttlSeconds * 1000);
  }

  private async guardConcurrentJobs(
    workspaceId: string,
    limit: number,
  ): Promise<void> {
    const key = `quota:${workspaceId}:running-jobs`;
    const running = Number((await this.cacheManager.get<number>(key)) ?? 0);

    if (running >= limit) {
      throw new HttpException(
        '当前并发任务数已经顶格，先让前面的任务跑完。',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async ensureSubscriptionWithManager(
    manager: EntityManager,
    workspaceId: string,
  ): Promise<Subscription> {
    const subscriptionRepository = manager.getRepository(Subscription);
    const existing = await subscriptionRepository.findOne({
      where: { workspaceId },
    });

    if (existing) {
      return existing;
    }

    return subscriptionRepository.save(
      subscriptionRepository.create({
        workspaceId,
        plan: 'free',
        status: 'active',
      }),
    );
  }

  private getStripePriceId(plan: Exclude<BillingPlan, 'free'>): string {
    const envKey = plan === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_TEAM';
    const priceId = this.configService.get<string>(envKey);
    if (!priceId) {
      throw new HttpException(
        `缺少 Stripe 价格配置: ${envKey}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return priceId;
  }

  private async ensureStripeCustomer(workspaceId: string): Promise<string> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const subscription = await this.ensureSubscriptionWithManager(
          manager,
          workspaceId,
        );
        if (subscription.stripeCustomerId) {
          return subscription.stripeCustomerId;
        }
        if (!this.stripe) {
          throw new HttpException(
            'Stripe 未启用，无法创建客户',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const customer = await this.stripe.customers.create({
          metadata: {
            workspaceId,
          },
          name: `Workspace ${workspaceId}`,
        });
        subscription.stripeCustomerId = customer.id;
        await manager.getRepository(Subscription).save(subscription);
        return customer.id;
      },
    );
  }

  private async syncSubscriptionFromStripeEvent(
    event: StripeWebhookEvent,
  ): Promise<Subscription> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession;
        const workspaceId =
          session.metadata?.workspaceId || session.client_reference_id;
        const plan = this.toBillingPlan(session.metadata?.plan);
        if (!workspaceId || !plan) {
          throw new HttpException(
            'Stripe Checkout 缺少 workspaceId 或 plan',
            HttpStatus.BAD_REQUEST,
          );
        }

        return this.syncSubscriptionFromWebhook({
          workspaceId,
          plan,
          status: 'active',
          stripeCustomerId: this.readStripeId(session.customer),
          stripeSubscriptionId: this.readStripeId(session.subscription),
        });
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as StripeSubscriptionObject;
        const workspaceId = subscription.metadata?.workspaceId;
        const plan = this.planFromStripeSubscription(subscription);
        if (!workspaceId || !plan) {
          throw new HttpException(
            'Stripe Subscription 缺少 workspaceId 或 plan',
            HttpStatus.BAD_REQUEST,
          );
        }

        return this.syncSubscriptionFromWebhook({
          workspaceId,
          plan,
          status: subscription.status,
          stripeCustomerId: this.readStripeId(subscription.customer),
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: subscription.items.data[0]?.current_period_end
            ? new Date(
                subscription.items.data[0].current_period_end * 1000,
              ).toISOString()
            : undefined,
        });
      }
      default:
        this.logger.debug(`忽略未处理的 Stripe webhook 事件: ${event.type}`);
        throw new HttpException(
          `未处理的 Stripe 事件类型: ${event.type}`,
          HttpStatus.ACCEPTED,
        );
    }
  }

  private planFromStripeSubscription(
    subscription: StripeSubscriptionObject,
  ): BillingPlan | null {
    const metadataPlan = this.toBillingPlan(subscription.metadata?.plan);
    if (metadataPlan) {
      return metadataPlan;
    }

    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      return null;
    }

    if (priceId === this.configService.get<string>('STRIPE_PRICE_PRO')) {
      return 'pro';
    }
    if (priceId === this.configService.get<string>('STRIPE_PRICE_TEAM')) {
      return 'team';
    }
    return null;
  }

  private toBillingPlan(value?: string): BillingPlan | null {
    if (value === 'free' || value === 'pro' || value === 'team') {
      return value;
    }
    return null;
  }

  private readStripeId(
    value: string | { id?: string } | null | undefined,
  ): string | undefined {
    return typeof value === 'string' ? value : value?.id;
  }
}
