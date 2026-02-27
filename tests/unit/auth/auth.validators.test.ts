import { describe, expect, it } from 'vitest';
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
  MFADisableRequestSchema,
  MFAEnableRequestSchema,
  RefreshTokenRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  RevokeAllTokensRequestSchema,
  SessionIdParamSchema,
  VerifyEmailRequestSchema,
} from '../../../server/src/validators/auth.validators';

describe('auth.validators', () => {
  it('login validates with required fields', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(result.success).toBe(true);
  });

  it('login rejects invalid email', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'not-an-email',
      password: 'secret',
    });
    expect(result.success).toBe(false);
  });

  it('login rejects missing password', () => {
    const result = LoginRequestSchema.safeParse({
      email: 'user@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('register validates with required fields', () => {
    const result = RegisterRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(result.success).toBe(true);
  });

  it('register rejects short password', () => {
    const result = RegisterRequestSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(result.success).toBe(false);
  });

  it('refresh token schema allows missing token (cookie flow)', () => {
    const result = RefreshTokenRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('refresh token schema rejects empty token string', () => {
    const result = RefreshTokenRequestSchema.safeParse({ refreshToken: '' });
    expect(result.success).toBe(false);
  });

  it('change password validates strong password', () => {
    const result = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });
    expect(result.success).toBe(true);
  });

  it('change password rejects missing uppercase', () => {
    const result = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'lowercase1',
    });
    expect(result.success).toBe(false);
  });

  it('change password rejects missing lowercase', () => {
    const result = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'UPPERCASE1',
    });
    expect(result.success).toBe(false);
  });

  it('change password rejects missing number', () => {
    const result = ChangePasswordRequestSchema.safeParse({
      currentPassword: 'OldPassword1',
      newPassword: 'NoNumberPassword',
    });
    expect(result.success).toBe(false);
  });

  it('reset password validates strong password', () => {
    const result = ResetPasswordRequestSchema.safeParse({
      token: 'reset-token',
      newPassword: 'NewPassword1',
    });
    expect(result.success).toBe(true);
  });

  it('reset password rejects missing number', () => {
    const result = ResetPasswordRequestSchema.safeParse({
      token: 'reset-token',
      newPassword: 'NoNumber',
    });
    expect(result.success).toBe(false);
  });

  it('verify email requires token', () => {
    const result = VerifyEmailRequestSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('MFA enable requires token', () => {
    const result = MFAEnableRequestSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('MFA disable requires token', () => {
    const result = MFADisableRequestSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('revoke all tokens rejects invalid uuid', () => {
    const result = RevokeAllTokensRequestSchema.safeParse({ userId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('session id param rejects invalid uuid', () => {
    const result = SessionIdParamSchema.safeParse({ id: 'bad-id' });
    expect(result.success).toBe(false);
  });
});
