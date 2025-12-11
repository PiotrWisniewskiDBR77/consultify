import { vi } from 'vitest';

export const verify = vi.fn();
export const sign = vi.fn();
export const decode = vi.fn();

export default {
    verify,
    sign,
    decode
};
