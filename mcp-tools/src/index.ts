import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// The URL of our locally running Hono API
const API_BASE_URL = 'http://localhost:9000/api/v1';

class JourneyAgentServer {
  private server: Server;
  private apiKey: string;
  private app: express.Application;
  private transport: SSEServerTransport | null = null;

  constructor() {
    this.apiKey = process.env.RAILRADAR_API_KEY || '';
    if (!this.apiKey) {
      console.error('RAILRADAR_API_KEY environment variable is required');
      process.exit(1);
    }

    this.server = new Server(
      {
        name: 'journey-agent-mcp-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.app = express();
    this.app.use(cors());

    this.setupToolHandlers();
    this.setupExpressRoutes();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async fetchApi(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_stations',
          description: 'Search for stations by code or name',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query (station code or name)' }
            },
            required: ['query'],
          },
        },
        {
          name: 'search_trains',
          description: 'Search for trains by number or name',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query (train number or name)' }
            },
            required: ['query'],
          },
        },
        {
          name: 'get_live_map',
          description: 'Retrieves real-time position data for all currently running trains',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_train_schedule',
          description: 'Retrieves the detailed schedule/route for a specific train on a given journey date',
          inputSchema: {
            type: 'object',
            properties: {
              trainNumber: { type: 'string', description: '5-digit train number' },
              journeyDate: { type: 'string', description: 'Journey date in YYYY-MM-DD format' }
            },
            required: ['trainNumber', 'journeyDate'],
          },
        },
        {
          name: 'list_trains',
          description: 'Retrieves a paginated list of trains with filtering and search capabilities',
          inputSchema: {
            type: 'object',
            properties: {
              page: { type: 'string' },
              limit: { type: 'string' },
              type: { type: 'string', description: 'Filter by train type' },
              zone: { type: 'string', description: 'Filter by railway zone' },
              search: { type: 'string', description: 'Search in train number, name, or station codes' }
            },
          },
        },
        {
          name: 'get_live_station_board',
          description: 'Retrieves real-time information about trains arriving at or departing from a specific station',
          inputSchema: {
            type: 'object',
            properties: {
              stationCode: { type: 'string', description: 'Station code (e.g., NDLS)' },
              hours: { type: 'string', description: 'Time window in hours (1-8)' },
              toStationCode: { type: 'string', description: 'Optional destination filter' }
            },
            required: ['stationCode'],
          },
        },
        {
          name: 'get_trains_between',
          description: 'Finds all trains that run between two specified stations',
          inputSchema: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source station code' },
              to: { type: 'string', description: 'Destination station code' }
            },
            required: ['from', 'to'],
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'search_stations': {
            const { query } = request.params.arguments as any;
            const data = await this.fetchApi('/search/stations', { query });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'search_trains': {
            const { query } = request.params.arguments as any;
            const data = await this.fetchApi('/search/trains', { query });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'get_live_map': {
            const data = await this.fetchApi('/trains/live-map');
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'get_train_schedule': {
            const { trainNumber, journeyDate } = request.params.arguments as any;
            const data = await this.fetchApi(`/trains/${encodeURIComponent(trainNumber)}/schedule`, { journeyDate });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'list_trains': {
            const args = request.params.arguments as any || {};
            const data = await this.fetchApi('/trains/list', args);
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'get_live_station_board': {
            const { stationCode, hours, toStationCode } = request.params.arguments as any;
            const data = await this.fetchApi(`/stations/${encodeURIComponent(stationCode)}/live`, { hours, toStationCode });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          case 'get_trains_between': {
            const { from, to } = request.params.arguments as any;
            const data = await this.fetchApi('/trains/between', { from, to });
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  private setupExpressRoutes() {
    this.app.get('/sse', async (req, res) => {
      console.log('New SSE connection established');
      this.transport = new SSEServerTransport('/message', res);
      await this.server.connect(this.transport);
    });

    this.app.post('/message', async (req, res) => {
      if (!this.transport) {
        res.status(400).send('No active SSE connection');
        return;
      }
      await this.transport.handlePostMessage(req, res);
    });
  }

  async run() {
    const port = process.env.PORT || 3001;
    this.app.listen(port, () => {
      console.log(`Journey Agent MCP SSE server running on http://localhost:${port}/sse`);
    });
  }
}

const server = new JourneyAgentServer();
server.run().catch(console.error);
