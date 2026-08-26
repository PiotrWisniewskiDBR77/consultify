/**
 * DEC-91 — the invitation-accept refusal must reach the client as a 403 with
 * the shared DEC-91 body, not as a generic 500.
 *
 * The gate itself lives in `invitationService.acceptInvitation` (covered by
 * `services/__tests__/invitationAcceptOrgSuspension.test.ts`), but that gate
 * THROWS, and `InvitationController.acceptInvitation` decides what a thrown
 * error becomes on the wire. Its pre-existing mapper is a prose-matching
 * allowlist that falls through to 500 — so without the explicit branch this
 * suite pins, a suspended tenant's invitee would receive "500 Failed to accept
 * invitation", indistinguishable from a real outage and carrying none of the
 * machine-readable payload the client branches on.
 *
 * Matching on the error CODE rather than on the message is the point: the two
 * cases below fail if someone reintroduces prose matching, because the message
 * text here is deliberately not in that allowlist.
 */

import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const acceptInvitation = vi.fn();
vi.mock('../../services/invitationService.js', () => ({
  acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
}));

const { InvitationController } = await import('../InvitationController.js');

interface Captured {
  status: number | null;
  body: Record<string, unknown> | null;
}

const runAccept = async (): Promise<Captured> => {
  const captured: Captured = { status: null, body: null };
  const req = {
    body: {
      token: 'inv_tok_whatever',
      email: 'invitee@example.com',
      firstName: 'In',
      lastName: 'Vitee',
      password: 'correct horse battery staple',
    },
    get: () => undefined,
  } as never;

  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;

  await (InvitationController as never as { acceptInvitation: Function }).acceptInvitation(
    req,
    res,
    () => undefined
  );
  return captured;
};

describe('DEC-91 — invitation accept surfaces the suspension as a 403', () => {
  beforeEach(() => {
    acceptInvitation.mockReset();
  });

  it('answers 403 with the shared DEC-91 body when the service refuses', async () => {
    const suspended = new Error(
      'This organization is suspended and cannot accept new members right now.'
    ) as Error & { code?: string };
    suspended.code = 'ORG_SUSPENDED';
    acceptInvitation.mockRejectedValue(suspended);

    const result = await runAccept();

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      code: 'ORG_SUSPENDED',
      messageKey: 'errors.organizationSuspended',
    });
  });

  it('NEGATIVE CONTROL: an ordinary failure still maps through the pre-existing rules', async () => {
    acceptInvitation.mockRejectedValue(new Error('Invalid invitation token'));

    const result = await runAccept();

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'INVITATION_ACCEPT_INVALID' } });
  });
});
