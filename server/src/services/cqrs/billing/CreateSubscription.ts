import { createSubscription } from '../../BillingService.js';
import { CommandHandler } from '../CommandBus.js';

export class CreateSubscriptionCommand {
  constructor(
    public readonly orgId: string,
    public readonly planId: string,
    public readonly paymentMethodId: string,
    public readonly email: string,
    public readonly orgName: string
  ) {}
}

export class CreateSubscriptionHandler implements CommandHandler<CreateSubscriptionCommand> {
  async execute(command: CreateSubscriptionCommand): Promise<void> {
    await createSubscription(
      command.orgId,
      command.planId,
      command.paymentMethodId,
      command.email,
      command.orgName
    );
  }
}
