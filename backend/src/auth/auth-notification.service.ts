import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InviteEmailResult {
  mode: 'resend' | 'stub';
  delivered: boolean;
  message: string;
}

@Injectable()
export class AuthNotificationService {
  private readonly logger = new Logger(AuthNotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendWorkspaceInvitationEmail(input: {
    recipientEmail: string;
    workspaceName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: string;
  }): Promise<InviteEmailResult> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');

    if (!apiKey || !fromEmail) {
      this.logger.warn(
        `未配置邀请邮件通道，改为 stub 输出: ${input.recipientEmail} -> ${input.inviteUrl}`,
      );
      return {
        mode: 'stub',
        delivered: false,
        message:
          '未配置 RESEND_API_KEY / RESEND_FROM_EMAIL，邀请已创建，但邮件未真实发出。',
      };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.recipientEmail],
        subject: `加入 ${input.workspaceName} 工作空间`,
        html: this.buildInviteHtml(input),
        text: this.buildInviteText(input),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`邀请邮件发送失败: ${errorText}`);
      return {
        mode: 'resend',
        delivered: false,
        message: `邀请已创建，但邮件发送失败: ${errorText || response.status}`,
      };
    }

    return {
      mode: 'resend',
      delivered: true,
      message: '邀请邮件已发送。',
    };
  }

  private buildInviteHtml(input: {
    recipientEmail: string;
    workspaceName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2>你收到了一条工作空间邀请</h2>
        <p>${this.escapeHtml(input.inviterName)} 邀请你加入 <strong>${this.escapeHtml(
          input.workspaceName,
        )}</strong>，目标角色是 <strong>${this.escapeHtml(input.role)}</strong>。</p>
        <p>邀请有效期到 ${this.escapeHtml(input.expiresAt)}。</p>
        <p>
          <a href="${this.escapeHtml(input.inviteUrl)}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;">
            接受邀请
          </a>
        </p>
        <p>如果按钮点不了，就复制这个链接：</p>
        <p>${this.escapeHtml(input.inviteUrl)}</p>
        <p>收件邮箱：${this.escapeHtml(input.recipientEmail)}</p>
      </div>
    `;
  }

  private buildInviteText(input: {
    recipientEmail: string;
    workspaceName: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresAt: string;
  }): string {
    return [
      `${input.inviterName} 邀请你加入 ${input.workspaceName}`,
      `角色: ${input.role}`,
      `有效期: ${input.expiresAt}`,
      `接受邀请: ${input.inviteUrl}`,
      `收件邮箱: ${input.recipientEmail}`,
    ].join('\n');
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
