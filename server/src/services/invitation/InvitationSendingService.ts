import logger from '../../utils/Logger.js';

export class InvitationSendingService {
    private getInviteLink(token: string): string {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return `${baseUrl}/join?token=${token}`;
    }

    async sendOrgInvitation(email: string, token: string): Promise<string> {
        const inviteLink = this.getInviteLink(token);

        // Simulate email sending
        logger.info(`[EMAIL SERVICE] Sending ORG invitation to ${email}`);
        logger.info(`[EMAIL SERVICE] Link: ${inviteLink}`);

        return inviteLink;
    }

    async sendProjectInvitation(email: string, projectName: string, token: string): Promise<string> {
        const inviteLink = this.getInviteLink(token);

        // Simulate email sending
        logger.info(`[EMAIL SERVICE] Sending PROJECT invitation to ${email}`);
        logger.info(`[EMAIL SERVICE] Project: ${projectName}`);
        logger.info(`[EMAIL SERVICE] Link: ${inviteLink}`);

        return inviteLink;
    }

    async sendResentInvitation(email: string, token: string): Promise<string> {
        const inviteLink = this.getInviteLink(token);

        // Simulate email resend
        logger.info(`[EMAIL SERVICE] Resending invitation to ${email}`);
        logger.info(`[EMAIL SERVICE] New Link: ${inviteLink}`);

        return inviteLink;
    }
}
