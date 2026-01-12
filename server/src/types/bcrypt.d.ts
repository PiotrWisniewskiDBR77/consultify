/**
 * Type declarations for bcrypt module
 * Used when @types/bcrypt is not available or incompatible
 */

declare module 'bcrypt' {
    export function hash(data: string | Buffer, saltRounds: number): Promise<string>;
    export function hashSync(data: string | Buffer, saltRounds: number): string;
    
    export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
    export function compareSync(data: string | Buffer, encrypted: string): boolean;
    
    export function genSalt(rounds?: number): Promise<string>;
    export function genSaltSync(rounds?: number): string;
    
    export function getRounds(hash: string): number;
}

