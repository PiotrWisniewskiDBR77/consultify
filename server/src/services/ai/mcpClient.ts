/**
 * MCP Client - Model Context Protocol Integration
 * Enables external tool plugins via the MCP protocol
 *
 * @version 1.0.0
 * @see https://modelcontextprotocol.io
 */

import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

import { aiLogger } from './logger.js';

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'http' | 'websocket';
  command?: string; // For stdio transport
  args?: string[]; // For stdio transport
  url?: string; // For http/websocket transport
  env?: Record<string, string>;
  enabled: boolean;
  autoConnect: boolean;
  timeout?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPServerConnection {
  config: MCPServerConfig;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  process?: ChildProcess;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  lastError?: string;
  messageId: number;
  pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
}

class MCPClient extends EventEmitter {
  private servers: Map<string, MCPServerConnection> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the MCP client with server configurations
   */
  async initialize(configs: MCPServerConfig[]): Promise<void> {
    if (this.initialized) {
      aiLogger.warn('MCPClient', 'Already initialized');
      return;
    }

    for (const config of configs) {
      this.servers.set(config.id, {
        config,
        status: 'disconnected',
        tools: [],
        resources: [],
        prompts: [],
        messageId: 0,
        pendingRequests: new Map(),
      });

      if (config.enabled && config.autoConnect) {
        try {
          await this.connect(config.id);
        } catch (error) {
          aiLogger.error('MCPClient', `Failed to auto-connect to ${config.name}`, {
            error: (error as Error).message,
          });
        }
      }
    }

    this.initialized = true;
    aiLogger.info('MCPClient', `Initialized with ${configs.length} servers`);
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status === 'connected') {
      return;
    }

    server.status = 'connecting';
    this.emit('server:connecting', serverId);

    try {
      if (server.config.transport === 'stdio') {
        await this.connectStdio(server);
      } else if (server.config.transport === 'http') {
        await this.connectHttp(server);
      } else {
        throw new Error(`Unsupported transport: ${server.config.transport}`);
      }

      // Initialize the connection
      await this.initializeConnection(server);

      // Fetch capabilities
      await this.refreshCapabilities(serverId);

      server.status = 'connected';
      this.emit('server:connected', serverId);

      aiLogger.info('MCPClient', `Connected to ${server.config.name}`, {
        tools: server.tools.length,
        resources: server.resources.length,
      });
    } catch (error) {
      server.status = 'error';
      server.lastError = (error as Error).message;
      this.emit('server:error', serverId, error);
      throw error;
    }
  }

  /**
   * Connect via stdio transport
   */
  private async connectStdio(server: MCPServerConnection): Promise<void> {
    const { command, args = [], env = {} } = server.config;

    if (!command) {
      throw new Error('Command is required for stdio transport');
    }

    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      server.process = process;

      let buffer = '';

      process.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();

        // Process complete messages (newline-delimited JSON)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message: MCPMessage = JSON.parse(line);
              this.handleMessage(server, message);
            } catch (error) {
              aiLogger.warn('MCPClient', 'Failed to parse message', { line });
            }
          }
        }
      });

      process.stderr?.on('data', (data: Buffer) => {
        aiLogger.warn('MCPClient', `Server stderr: ${data.toString()}`);
      });

      process.on('error', (error) => {
        server.status = 'error';
        server.lastError = error.message;
        reject(error);
      });

      process.on('exit', (code) => {
        server.status = 'disconnected';
        this.emit('server:disconnected', server.config.id);
        aiLogger.info('MCPClient', `Server ${server.config.name} exited with code ${code}`);
      });

      // Give the process time to start
      setTimeout(resolve, 500);
    });
  }

  /**
   * Connect via HTTP transport
   */
  private async connectHttp(server: MCPServerConnection): Promise<void> {
    const { url } = server.config;

    if (!url) {
      throw new Error('URL is required for HTTP transport');
    }

    // Test connection
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(server.config.timeout || 5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP server returned ${response.status}`);
    }
  }

  /**
   * Initialize MCP connection with handshake
   */
  private async initializeConnection(server: MCPServerConnection): Promise<void> {
    const response = await this.sendRequest(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
      },
      clientInfo: {
        name: 'Consultify',
        version: '1.0.0',
      },
    });

    aiLogger.debug('MCPClient', 'Initialize response', response);

    // Send initialized notification
    await this.sendNotification(server, 'notifications/initialized', {});
  }

  /**
   * Refresh server capabilities (tools, resources, prompts)
   */
  async refreshCapabilities(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      return;
    }

    try {
      // Get tools
      const toolsResponse = (await this.sendRequest(server, 'tools/list', {})) as {
        tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
      };
      server.tools = (toolsResponse.tools || []).map((tool) => ({
        ...tool,
        description: tool.description || '',
        inputSchema: tool.inputSchema as MCPTool['inputSchema'] || { type: 'object', properties: {} },
        serverId,
      }));

      // Get resources
      const resourcesResponse = (await this.sendRequest(server, 'resources/list', {})) as {
        resources?: Array<{ uri: string; name: string; description?: string; mimeType?: string }>;
      };
      server.resources = (resourcesResponse.resources || []).map((resource) => ({
        ...resource,
        serverId,
      }));

      // Get prompts
      const promptsResponse = (await this.sendRequest(server, 'prompts/list', {})) as {
        prompts?: Array<{ name: string; description?: string; arguments?: unknown[] }>;
      };
      server.prompts = (promptsResponse.prompts || []).map((prompt) => ({
        ...prompt,
        arguments: prompt.arguments as MCPPrompt['arguments'],
        serverId,
      }));

      this.emit('capabilities:updated', serverId);
    } catch (error) {
      aiLogger.warn('MCPClient', `Failed to refresh capabilities for ${serverId}`, {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(server: MCPServerConnection, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++server.messageId;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        server.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, server.config.timeout || 30000);

      server.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.sendMessage(server, message);
    });
  }

  /**
   * Send a JSON-RPC notification
   */
  private sendNotification(server: MCPServerConnection, method: string, params: unknown): void {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.sendMessage(server, message);
  }

  /**
   * Send a message to the server
   */
  private sendMessage(server: MCPServerConnection, message: MCPMessage): void {
    const data = JSON.stringify(message) + '\n';

    if (server.config.transport === 'stdio' && server.process?.stdin) {
      server.process.stdin.write(data);
    } else if (server.config.transport === 'http') {
      // HTTP would be handled differently with fetch
      fetch(`${server.config.url}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      }).catch((error) => {
        aiLogger.error('MCPClient', 'HTTP send failed', { error: error.message });
      });
    }
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(server: MCPServerConnection, message: MCPMessage): void {
    if (message.id !== undefined) {
      // Response to a request
      const pending = server.pendingRequests.get(message.id as number);
      if (pending) {
        server.pendingRequests.delete(message.id as number);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // Notification from server
      this.emit('notification', server.config.id, message.method, message.params);
    }
  }

  /**
   * Call a tool on a server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const tool = server.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    aiLogger.info('MCPClient', `Calling tool ${toolName} on ${serverId}`, { args });

    const response = await this.sendRequest(server, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    return response;
  }

  /**
   * Read a resource from a server
   */
  async readResource(serverId: string, uri: string): Promise<{ content: string; mimeType?: string }> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} is not available`);
    }

    const response = (await this.sendRequest(server, 'resources/read', { uri })) as {
      contents?: Array<{ text?: string; blob?: string; mimeType?: string }>;
    };

    const content = response.contents?.[0];
    return {
      content: content?.text || content?.blob || '',
      mimeType: content?.mimeType,
    };
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<{ messages: Array<{ role: string; content: string }> }> {
    const server = this.servers.get(serverId);
    if (!server || server.status !== 'connected') {
      throw new Error(`Server ${serverId} is not available`);
    }

    const response = (await this.sendRequest(server, 'prompts/get', {
      name: promptName,
      arguments: args,
    })) as { messages?: Array<{ role: string; content: { type: string; text: string } }> };

    return {
      messages: (response.messages || []).map((m) => ({
        role: m.role,
        content: m.content?.text || '',
      })),
    };
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    if (server.process) {
      server.process.kill();
      server.process = undefined;
    }

    server.status = 'disconnected';
    server.tools = [];
    server.resources = [];
    server.prompts = [];

    this.emit('server:disconnected', serverId);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const serverId of this.servers.keys()) {
      await this.disconnect(serverId);
    }
  }

  /**
   * Get all registered tools
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'connected') {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  /**
   * Get all available resources
   */
  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'connected') {
        resources.push(...server.resources);
      }
    }
    return resources;
  }

  /**
   * Get all available prompts
   */
  getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'connected') {
        prompts.push(...server.prompts);
      }
    }
    return prompts;
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): MCPServerConnection | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all servers
   */
  getAllServers(): MCPServerConnection[] {
    return Array.from(this.servers.values());
  }

  /**
   * Add a new server configuration
   */
  addServer(config: MCPServerConfig): void {
    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} already exists`);
    }

    this.servers.set(config.id, {
      config,
      status: 'disconnected',
      tools: [],
      resources: [],
      prompts: [],
      messageId: 0,
      pendingRequests: new Map(),
    });

    this.emit('server:added', config.id);
  }

  /**
   * Remove a server
   */
  async removeServer(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    this.servers.delete(serverId);
    this.emit('server:removed', serverId);
  }

  /**
   * Update server configuration
   */
  updateServerConfig(serverId: string, updates: Partial<MCPServerConfig>): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    server.config = { ...server.config, ...updates };
    this.emit('server:updated', serverId);
  }
}

export const mcpClient = new MCPClient();
export default mcpClient;
