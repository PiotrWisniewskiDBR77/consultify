import { CommandBus } from './CommandBus.js';
import { QueryBus } from './QueryBus.js';

export const commandBus = new CommandBus();
export const queryBus = new QueryBus();

export * from './CommandBus.js';
export * from './QueryBus.js';
