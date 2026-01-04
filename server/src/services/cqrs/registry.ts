import { CreateSubscriptionCommand, CreateSubscriptionHandler } from './billing/CreateSubscription.js';
import { commandBus } from './index.js';
import { CreateInitiativeCommand, CreateInitiativeHandler } from './initiative/CreateInitiative.js';
import { CreateTaskCommand, CreateTaskHandler } from './task/CreateTask.js';
import logger from '../../utils/Logger.js';

export function registerCQRSHandlers() {
    // Initiatives
    commandBus.register(CreateInitiativeCommand, new CreateInitiativeHandler());

    // Billing
    commandBus.register(CreateSubscriptionCommand, new CreateSubscriptionHandler());

    // Tasks
    commandBus.register(CreateTaskCommand, new CreateTaskHandler());

    logger.info('[CQRS] Handlers registered');
}
