export interface IPlugin {
    name: string;
    version: string;
    init(context: any): Promise<void>;
    shutdown?(): Promise<void>;
}
