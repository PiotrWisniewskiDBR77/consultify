import { describe, expect, it, vi } from 'vitest';

import { InvitationSendingService } from '../InvitationSendingService.js';

describe('InvitationSendingService delivery truth', () => {
  it('reports SENT when the provider accepts an organization invitation', async () => {
    const sender = new InvitationSendingService(vi.fn().mockResolvedValue(true));

    await expect(sender.sendOrgInvitation('member@example.com', 'token')).resolves.toEqual({
      inviteLink: 'http://localhost:5173/join?token=token',
      deliveryStatus: 'SENT',
    });
  });

  it('reports FAILED when the provider returns false for a project invitation', async () => {
    const sender = new InvitationSendingService(vi.fn().mockResolvedValue(false));

    await expect(
      sender.sendProjectInvitation('member@example.com', 'Program', 'token')
    ).resolves.toEqual({
      inviteLink: 'http://localhost:5173/join?token=token',
      deliveryStatus: 'FAILED',
    });
  });

  it('reports FAILED without rejecting when resend delivery throws', async () => {
    const sender = new InvitationSendingService(
      vi.fn().mockRejectedValue(new Error('provider unavailable'))
    );

    await expect(sender.sendResentInvitation('member@example.com', 'token')).resolves.toEqual({
      inviteLink: 'http://localhost:5173/join?token=token',
      deliveryStatus: 'FAILED',
    });
  });
});
