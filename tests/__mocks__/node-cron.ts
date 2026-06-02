import { vi } from 'vitest';

type CronTask = {
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

const task: CronTask = {
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
};

export const schedule = vi.fn(() => task);
export const createTask = vi.fn(() => task);
export const validate = vi.fn(() => true);

export default {
  schedule,
  createTask,
  validate,
};
