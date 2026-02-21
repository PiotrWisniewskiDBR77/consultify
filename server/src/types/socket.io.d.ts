declare module 'socket.io' {
  export class Server {
    constructor(httpServer?: any, options?: any);
    on(event: string, callback: (socket: Socket) => void): void;
    emit(event: string, data?: any): void;
    of(namespace: string): Namespace;
  }

  export class Namespace {
    on(event: string, callback: (socket: Socket) => void): void;
    emit(event: string, data?: any): void;
  }

  export class Socket {
    id: string;
    rooms: Set<string>;
    on(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, data?: any): void;
    join(room: string): void;
    leave(room: string): void;
    to(room: string): Socket;
  }
}
