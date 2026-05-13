import { McpClientService } from './mcpClient.js';
import { logTrace } from './logger.js';
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
}

export class OllamaOrchestrator {
  private ollamaUrl: string;

  constructor(
    private model: string,
    private mcpService: McpClientService,
    ollamaUrl?: string
  ) {
    this.ollamaUrl = ollamaUrl || 'http://localhost:11434';
  }

  // Fetch tools from the MCP server and convert them to Ollama's schema format
  private async getOllamaTools() {
    const mcpTools = await this.mcpService.getTools();
    return mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));
  }

  // Core orchestration loop
  async chat(messages: ChatMessage[], onChunk?: (chunk: string) => void): Promise<ChatMessage[]> {
    const tools = await this.getOllamaTools();
    const currentMessages = [...messages];

    // Inject system persona to improve answer quality and formatting
    if (!currentMessages.some(m => m.role === 'system')) {
      currentMessages.unshift({
        role: 'system',
        content: `You are JourneyAgent, a highly professional, helpful, and friendly AI travel planner.
Your goal is to help users find trains, check schedules, and plan journeys.
CRITICAL INSTRUCTIONS:
1. NEVER say "Based on the provided tool response", "According to the JSON", or "Here is the data". Act as if you inherently know this information.
2. Present the data beautifully using Markdown. Use bolding for train names/times and bullet points for readability.
3. Be conversational and helpful. If they ask for trains to a city, give them the best options clearly and ask if they need more details.
4. Do not mention technical metadata (like traceIds, execution time, or raw JSON fields) unless explicitly asked.
5. NEVER hallucinate or guess real-world travel data (schedules, routes, trains) from your training memory. You MUST ALWAYS use the provided tools to fetch real data before answering. If you can't find it via tools, admit you don't know rather than inventing data.
TOOL USAGE GUIDELINES:
- When searching for a specific class of train (like "Vande Bharat" or "Shatabdi"), NEVER combine it with a city name in the search_trains tool. Search ONLY for the train class (e.g., "Vande Bharat") to get the list, and then filter the results yourself based on the requested city.
- If looking for trains between cities, first use search_stations to find the exact station codes, then use get_trains_between or get_live_station_board.`
      });
    }

    while (true) {
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: currentMessages,
          tools,
          stream: !!onChunk
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      if (onChunk && response.body) {
        // Handle streaming response using Web Streams API
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let toolCalls: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n').filter(l => l.trim() !== '');
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                assistantMessage += parsed.message.content;
                onChunk(parsed.message.content);
              }
              if (parsed.message?.tool_calls) {
                toolCalls = [...toolCalls, ...parsed.message.tool_calls];
              }
              if (parsed.done) {
                break;
              }
            } catch (e) {
              // Ignore incomplete JSON chunks and parse on next cycle
            }
          }
        }

        const newMsg: ChatMessage = { role: 'assistant', content: assistantMessage };
        if (toolCalls.length > 0) newMsg.tool_calls = toolCalls;
        currentMessages.push(newMsg);
      } else {
        // Handle non-streaming response
        const data = await response.json();
        currentMessages.push(data.message);
      }

      const lastMessage = currentMessages[currentMessages.length - 1];

      // If Ollama decides to call tools, execute them via MCP and loop again!
      if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        for (const call of lastMessage.tool_calls) {
          console.log(`[Orchestrator] Executing tool: ${call.function.name}`);
          logTrace('Calling MCP Tool', { tool: call.function.name, args: call.function.arguments });
          try {
            const result: any = await this.mcpService.callTool(call.function.name, call.function.arguments);
            logTrace('MCP Tool Response', result);
            // Combine all text blocks returned by the tool
            const textResult = result.content.map((c: any) => c.text).join('\n');
            currentMessages.push({
              role: 'tool',
              content: textResult
            });
          } catch (err: any) {
            console.error(`[Orchestrator] Tool execution error:`, err);
            logTrace('MCP Tool Error', { error: err.message });
            currentMessages.push({
              role: 'tool',
              content: `Error executing tool: ${err.message}`
            });
          }
        }
        // Continue the while loop so Ollama can read the tool results
        continue;
      }

      // If there are no tool calls, Ollama has finished its final response
      logTrace('Final Agent Response', lastMessage);
      break;
    }

    return currentMessages;
  }
}
