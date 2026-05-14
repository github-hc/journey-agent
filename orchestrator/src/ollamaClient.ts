import { McpClientService } from './mcpClient.js';
import { logTrace } from './logger.js';
import { SYSTEM_PROMPT } from './prompts.js';
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
        content: SYSTEM_PROMPT
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
