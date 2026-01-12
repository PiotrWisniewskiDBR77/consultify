export default db;
declare namespace db {
    function serialize(callback: any): void;
    function prepare(sql: any): {
        run: (...args: any[]) => void;
        finalize: () => void;
    };
    function run(sql: any, params: any, callback: any): void;
    function get(sql: any, params: any, callback: any): void;
    function all(sql: any, params: any, callback: any): void;
    function close(): void;
}
//# sourceMappingURL=database.postgres.d.ts.map