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

  // File logging
  const logEntry = `[${timestamp}] TRACE: ${stepName}\n${util.inspect(payload, { depth: null })}\n----------------------------------------\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
};
