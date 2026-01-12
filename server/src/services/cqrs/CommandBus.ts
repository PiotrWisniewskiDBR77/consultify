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
        const handler = this.handlers.get(command?.constructor?.name);
        if (!handler) {
            throw new Error(`No handler registered for command "${command?.constructor?.name}"`);
        }
        return handler.execute(command);
    }
}
