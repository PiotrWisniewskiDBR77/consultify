export interface CommandHandler<TCommand = unknown, TResult = unknown> {
  execute(command: TCommand): Promise<TResult>;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler>();

  register(commandCtor: Function, handler: CommandHandler): void {
    this.handlers.set(commandCtor.name, handler);
  }

  deregister(commandCtor: Function): void {
    this.handlers.delete(commandCtor.name);
  }

  async execute<TCommand>(command: TCommand): Promise<unknown> {
    const commandName = (command as any)?.constructor?.name;
    const handler = commandName ? this.handlers.get(commandName) : undefined;
    if (!handler) {
      throw new Error(`No handler registered for command "${commandName}"`);
    }
    return handler.execute(command);
  }
}
