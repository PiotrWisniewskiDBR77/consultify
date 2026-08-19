import logger from '../../utils/Logger.js';
import { send as sendEmail } from '../emailService.js';

export type InvitationDeliveryResult = {
  inviteLink: string;
  deliveryStatus: 'SENT' | 'FAILED';
};

type EmailSender = typeof sendEmail;

/**
 * InvitationSendingService
 *
 * Sends organization / project invitation emails via the shared SMTP-backed
 * emailService (DB `settings.smtp_*` with SMTP_* env fallback). When no SMTP
 * config is present or the provider rejects/throws, the link remains available
 * but delivery is reported truthfully as FAILED.
 */
export class InvitationSendingService {
  constructor(private readonly emailSender: EmailSender = sendEmail) {}

  private getInviteLink(token: string): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return `${baseUrl}/join?token=${token}`;
  }

  private buildInviteHtml(opts: {
    heading: string;
    intro: string;
    inviteLink: string;
    cta: string;
  }): string {
    const { heading, intro, inviteLink, cta } = opts;
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
        <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">${heading}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">${intro}</p>
        <a href="${inviteLink}" style="display: inline-block; background: #A51C30; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">${cta}</a>
        <p style="font-size: 12px; line-height: 1.6; color: #94a3b8; margin: 24px 0 0;">
          If the button does not work, copy and paste this link into your browser:<br/>
          <a href="${inviteLink}" style="color: #A51C30; word-break: break-all;">${inviteLink}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Consultify — Transformation AI Consulting Platform</p>
      </div>
    `;
  }

  async sendOrgInvitation(email: string, token: string): Promise<InvitationDeliveryResult> {
    const inviteLink = this.getInviteLink(token);
    try {
      const sent = await this.emailSender({
        to: email,
        subject: 'You have been invited to join an organization on Consultify',
        html: this.buildInviteHtml({
          heading: 'Join your team on Consultify',
          intro:
            'You have been invited to collaborate on Consultify — the AI-powered transformation consulting platform. Click below to accept your invitation and set up your account.',
          inviteLink,
          cta: 'Accept invitation',
        }),
        requireDelivery: true,
      });
      if (!sent) return { inviteLink, deliveryStatus: 'FAILED' };
      logger.info(`[InvitationSending] Org invitation dispatched to ${email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[InvitationSending] Org invitation email failed (link still returned): ${msg}`);
      return { inviteLink, deliveryStatus: 'FAILED' };
    }
    return { inviteLink, deliveryStatus: 'SENT' };
  }

  /** Canonical admin-IAM transport: never converts a provider failure into success. */
  async dispatchAdminIamInvitation(
    email: string,
    token: string,
    resent = false
  ): Promise<{ state: 'SENT' | 'FAILED'; code: string | null }> {
    const inviteLink = this.getInviteLink(token);
    try {
      const sent = await this.emailSender({
        to: email,
        subject: resent ? 'Your Consultify invitation (resent)' : 'You have been invited to Consultify',
        html: this.buildInviteHtml({
          heading: resent ? 'Your invitation to Consultify' : 'Join your team on Consultify',
          intro: resent
            ? 'Here is your invitation link again.'
            : 'You have been invited to collaborate on Consultify.',
          inviteLink,
          cta: 'Accept invitation',
        }),
        requireDelivery: true,
      });
      return sent ? { state: 'SENT', code: null } : { state: 'FAILED', code: 'EMAIL_PROVIDER_REJECTED' };
    } catch (error: any) {
      return { state: 'FAILED', code: String(error?.code || 'EMAIL_PROVIDER_ERROR').slice(0, 100) };
    }
  }

  async sendProjectInvitation(
    email: string,
    projectName: string,
    token: string
  ): Promise<InvitationDeliveryResult> {
    const inviteLink = this.getInviteLink(token);
    try {
      const sent = await this.emailSender({
        to: email,
        subject: `You have been invited to the project "${projectName}" on Consultify`,
        html: this.buildInviteHtml({
          heading: `Join "${projectName}" on Consultify`,
          intro: `You have been invited to collaborate on the project "${projectName}". Click below to accept your invitation.`,
          inviteLink,
          cta: 'Open project',
        }),
        requireDelivery: true,
      });
      if (!sent) return { inviteLink, deliveryStatus: 'FAILED' };
      logger.info(`[InvitationSending] Project invitation dispatched to ${email} (${projectName})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[InvitationSending] Project invitation email failed (link still returned): ${msg}`
      );
      return { inviteLink, deliveryStatus: 'FAILED' };
    }
    return { inviteLink, deliveryStatus: 'SENT' };
  }

  async sendResentInvitation(email: string, token: string): Promise<InvitationDeliveryResult> {
    const inviteLink = this.getInviteLink(token);
    try {
      const sent = await this.emailSender({
        to: email,
        subject: 'Your Consultify invitation (resent)',
        html: this.buildInviteHtml({
          heading: 'Your invitation to Consultify',
          intro:
            'Here is your invitation link again. Click below to accept and set up your account.',
          inviteLink,
          cta: 'Accept invitation',
        }),
        requireDelivery: true,
      });
      if (!sent) return { inviteLink, deliveryStatus: 'FAILED' };
      logger.info(`[InvitationSending] Invitation resent to ${email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[InvitationSending] Resent invitation email failed (link still returned): ${msg}`
      );
      return { inviteLink, deliveryStatus: 'FAILED' };
    }
    return { inviteLink, deliveryStatus: 'SENT' };
  }
}
