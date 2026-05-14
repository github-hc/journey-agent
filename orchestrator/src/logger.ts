import fs from 'fs';
import path from 'path';
import util from 'util';

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'agent-trace.log');

export const logTrace = (stepName: string, payload: any) => {
  if (process.env.AGENT_DEBUG !== 'true') return;

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();

  // Console logging
  console.log(`\n🔵 === [TRACE: ${stepName}] ===`);
  console.dir(payload, { depth: null, colors: true });
  console.log(`=============================\n`);

  // File logging - optimize payload to prevent editor freezing
  let logPayload = payload;

  try {
    // If this is an MCP response with a massive stringified JSON inside 'text', parse it so it formats cleanly
    if (payload?.content?.[0]?.type === 'text') {
      const parsedText = JSON.parse(payload.content[0].text);
      logPayload = { ...payload, content: [{ ...payload.content[0], text: parsedText }] };
    }
  } catch (e) {
    // Ignore, it's just raw text
  }

  let formattedPayload;
  try {
    formattedPayload = JSON.stringify(logPayload, null, 2);
  } catch (e) {
    formattedPayload = util.inspect(logPayload, { depth: 4 }); // Fallback with safe depth
  }

  const logEntry = `[${timestamp}] TRACE: ${stepName}\n${formattedPayload}\n----------------------------------------\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
};
