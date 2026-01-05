export interface QueryHandler<TQuery = unknown, TResult = unknown> {
    execute(query: TQuery): Promise<TResult>;
}

export class QueryBus {
    private handlers = new Map<string, QueryHandler>();

    register(queryCtor: Function, handler: QueryHandler): void {
        this.handlers.set(queryCtor.name, handler);
    }

    async execute<TResult>(query: unknown): Promise<TResult> {
        const queryName = (query as any)?.constructor?.name;
        const handler = queryName ? this.handlers.get(queryName) : undefined;
        if (!handler) {
            throw new Error(`No handler registered for query "${queryName}"`);
        }
        return handler.execute(query) as Promise<TResult>;
    }
}
