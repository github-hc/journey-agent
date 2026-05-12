import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
// Polyfill EventSource for Node.js environments
import { EventSource } from 'eventsource';
(global as any).EventSource = EventSource;

export class McpClientService {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private isConnected = false;
  private connectPromise: Promise<void> | null = null;

  constructor(private sseUrl: string) {}

  async connect() {
    if (this.isConnected && this.client) return;
    
    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        try {
          this.client = new Client(
            { name: 'journey-orchestrator', version: '1.0.0' },
            { capabilities: {} }
          );
          this.transport = new SSEClientTransport(new URL(this.sseUrl));
          await this.client.connect(this.transport);
          this.isConnected = true;
          console.log(`[MCP] Connected to SSE server at ${this.sseUrl}`);
        } catch (err) {
          this.connectPromise = null; // Allow retrying if it fails
          this.client = null;
          this.transport = null;
          console.error(`[MCP] Failed to connect:`, err);
          throw err;
        }
      })();
    }
    
    return this.connectPromise;
  }

  async getTools() {
    await this.connect();
    const response = await this.client!.listTools();
    return response.tools;
  }

  async callTool(name: string, args: Record<string, any>) {
    await this.connect();
    return this.client!.callTool({
      name,
      arguments: args,
    });
  }
}
