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
          description: 'Retrieves the detailed schedule/route for a specific train. WARNING: Requires exact 5-digit train number. Do NOT guess. Use search_trains FIRST if you only have a train name (e.g. "Shatabdi").',
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
          description: 'Retrieves real-time information about trains arriving/departing a station. WARNING: Requires exact 2-4 letter station code (e.g. "NDLS"). Do NOT guess codes. Use search_stations FIRST if you only have the city name.',
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
          description: 'Finds trains between two stations. PREREQUISITE: You must call search_stations FIRST to get verified codes. You do NOT know station codes from memory.',
          inputSchema: {
            type: 'object',
            properties: {
              verifiedSourceStationCode: { type: 'string', description: 'Station code returned by search_stations for the origin city. Example: JP for Jaipur.' },
              verifiedDestinationStationCode: { type: 'string', description: 'Station code returned by search_stations for the destination city. Example: NDLS for Delhi.' }
            },
            required: ['verifiedSourceStationCode', 'verifiedDestinationStationCode'],
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
            const rawData = await this.fetchApi('/search/trains', { query });
            
            // Critical fix for SLMs: Strip massive arrays like rakeDetails to prevent hallucination
            let cleanData = rawData;
            if (rawData?.success && Array.isArray(rawData?.data)) {
              cleanData = {
                success: true,
                data: rawData.data.map((t: any) => ({
                  trainNumber: t.trainNumber,
                  trainName: t.trainName,
                  sourceStationCode: t.sourceStationCode,
                  destinationStationCode: t.destinationStationCode,
                  runningDays: t.runningDays?.days,
                  travelTimeMinutes: t.travelTimeMinutes
                }))
              };
            }
            
            return { content: [{ type: 'text', text: JSON.stringify(cleanData, null, 2) }] };
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
            const { from, to, verifiedSourceStationCode, verifiedDestinationStationCode } = request.params.arguments as any;
            
            // Handle both old and new parameter names during transition
            const src = (verifiedSourceStationCode || from || '').toUpperCase();
            const dst = (verifiedDestinationStationCode || to || '').toUpperCase();

            const rawData = await this.fetchApi('/trains/between', { from: src, to: dst });
            
            // Clean the data to prevent SLM hallucination
            let cleanData = rawData;
            if (rawData?.success && Array.isArray(rawData?.data?.trains)) {
              cleanData = {
                ...rawData,
                data: {
                  ...rawData.data,
                  trains: rawData.data.trains.map((t: any) => ({
                    trainNumber: t.trainNumber,
                    trainName: t.trainName,
                    sourceStationCode: t.sourceStationCode,
                    destinationStationCode: t.destinationStationCode,
                    runningDays: t.runningDays?.days,
                    travelTimeMinutes: t.travelTimeMinutes
                  }))
                }
              };
            }
            
            // Agentic Feedback Loop: If the agent guessed a code and got 0 trains, explicitly instruct it to verify the code!
            if (cleanData?.success && cleanData?.data?.totalTrains === 0) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: JSON.stringify(cleanData, null, 2) + '\n\nAGENT WARNING: 0 trains found. Did you guess the station codes? You MUST call search_stations to verify the codes for these cities, then try get_trains_between again with the verified codes.' 
                }] 
              };
            }

            return { content: [{ type: 'text', text: JSON.stringify(cleanData, null, 2) }] };
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
