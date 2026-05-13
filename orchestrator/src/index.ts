import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { z } from 'zod';
import { cors } from 'hono/cors';
import 'dotenv/config';

import { McpClientService } from './mcpClient.js';
import { OllamaOrchestrator } from './ollamaClient.js';
import { logTrace } from './logger.js';

const app = new Hono();
app.use('/*', cors());

// Configuration
const MCP_SSE_URL = process.env.MCP_SSE_URL || 'http://localhost:3001/sse';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Initialize Services
const mcpService = new McpClientService(MCP_SSE_URL);
const orchestrator = new OllamaOrchestrator(OLLAMA_MODEL, mcpService, OLLAMA_URL);

// Request Schema
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.string(),
    tool_calls: z.any().optional()
  })),
  stream: z.boolean().optional().default(false)
});

// Orchestrator API Endpoint
app.post('/api/chat', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  logTrace('User Query Received', body);

  const parseResult = chatRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: parseResult.error }, 400);
  }

  const { messages, stream } = parseResult.data;

  try {
    if (stream) {
      // Stream the LLM response natively
      return streamText(c, async (streamWriter) => {
        await orchestrator.chat(messages, (chunk) => {
          streamWriter.write(chunk);
        });
      });
    } else {
      // Wait for the full loop (including tool calls) to finish
      const finalMessages = await orchestrator.chat(messages);
      const lastMessage = finalMessages[finalMessages.length - 1];
      return c.json({ message: lastMessage });
    }
  } catch (error: any) {
    console.error('[API Error]', error);
    return c.json({ error: error.message }, 500);
  }
});

// Health check root
app.get('/', (c) => c.text('Journey Agent Orchestrator is running'));

// Start server
const port = parseInt(process.env.PORT || '4000', 10);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[Orchestrator] Running on http://localhost:${info.port}`);
  console.log(`[Config] MCP URL: ${MCP_SSE_URL}`);
  console.log(`[Config] Ollama Model: ${OLLAMA_MODEL}`);
});
