import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { BillingService } from './billing.service';
import {
  CurrentUser,
  CurrentWorkspace,
} from '../auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../auth/guards/workspace.guard';
import type { AuthenticatedUser, WorkspaceContext } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

class CheckoutDto {
  @IsIn(['pro', 'team'])
  plan: 'pro' | 'team';

  @IsString()
  @IsUrl()
  successUrl: string;

  @IsString()
  @IsUrl()
  cancelUrl: string;
}

class WebhookDto {
  @IsString()
  workspaceId: string;

  @IsIn(['free', 'pro', 'team'])
  plan: 'free' | 'pro' | 'team';

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  stripeCustomerId?: string;

  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;

  @IsOptional()
  @IsString()
  currentPeriodEnd?: string;
}

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  plans() {
    return [
      { plan: 'free', monthlyTokens: 150000, monthlyRequests: 100 },
      { plan: 'pro', monthlyTokens: 1500000, monthlyRequests: 1000 },
      { plan: 'team', monthlyTokens: 10000000, monthlyRequests: 10000 },
    ];
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  usage(@CurrentWorkspace() workspace: WorkspaceContext) {
    return this.billingService.getUsageSummary(workspace.workspaceId);
  }

  @Post('checkout-session')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles('owner', 'admin')
  checkoutSession(
    @Body() body: CheckoutDto,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.billingService.createCheckoutSession({
      workspaceId: workspace.workspaceId,
      plan: body.plan,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Body() body: WebhookDto,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') stripeSignature?: string,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ) {
    return this.billingService.handleWebhook({
      rawBody: req.rawBody,
      stripeSignature,
      fallbackSecret: webhookSecret,
      payload: body,
    });
  }

  @Post('record-demo-usage')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  recordDemoUsage(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() workspace: WorkspaceContext,
  ) {
    return this.billingService.recordUsage({
      workspaceId: workspace.workspaceId,
      userId: user.id,
      eventType: 'llm',
      eventKey: `${workspace.workspaceId}:demo:${Date.now()}`,
      units: { tokens: 1000 },
      metadata: { source: 'manual-demo' },
    });
  }
}
