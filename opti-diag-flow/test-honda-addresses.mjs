import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JifelineParser } from './src/lib/trace-parser/jifeline-parser.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read Honda trace
const traceFile = path.join(__dirname, 'uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt');
const content = fs.readFileSync(traceFile, 'utf8');

console.log('Testing Honda address extraction...\n');

// Parse the trace
const parser = new JifelineParser();
const result = parser.parseTrace(content);

// Show first 10 messages with their source and target addresses
console.log('First 10 Honda messages:');
result.messages.slice(0, 10).forEach((msg, i) => {
  console.log(`  ${i+1}. Timestamp: ${msg.timestamp}`);
  console.log(`     Direction: ${msg.direction}`);
  console.log(`     Source: '${msg.sourceAddr}' Target: '${msg.targetAddr}'`);
  console.log(`     Data: ${msg.data?.substring(0,20)}...`);
  console.log('');
});