import { parseTraceFile } from './src/lib/trace-parser.ts';
import fs from 'fs';

// Read the Honda trace file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

// Log the first few lines to check format
console.log('=== FIRST 3 LINES (RAW) ===');
lines.slice(0, 3).forEach((line, i) => {
  console.log(`Line ${i}: ${line.substring(0, 150)}`);
});

// Parse the file
console.log('\n=== PARSING WITH parseTraceFile ===');
const result = parseTraceFile(content);

console.log('\nParsed results:');
console.log('- Messages:', result.messages.length);
console.log('- ECUs:', result.ecus.size);
console.log('- Services:', result.services.size);

// Check the first few messages
console.log('\n=== FIRST 5 MESSAGES ===');
result.messages.slice(0, 5).forEach((msg, i) => {
  console.log(`${i}: [${msg.protocol}] ${msg.sourceAddr || 'undefined'} -> ${msg.targetAddr || 'undefined'}`);
  console.log(`   Data: ${msg.data?.substring(0, 20) || 'empty'}`);
  if (msg.metadata) {
    console.log(`   Metadata:`, JSON.stringify(msg.metadata).substring(0, 100));
  }
});

// Check if parseLine is extracting addresses properly
console.log('\n=== MANUAL PARSING CHECK ===');
const testLine = lines[0];
const decodedLine = testLine
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&')
  .trim();

console.log('Test line (decoded):', decodedLine.substring(0, 150));

const dataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/;
const match = decodedLine.match(dataRegex);

if (match) {
  console.log('✓ Regex matches!');
  const args = match[7].split(',');
  const canId = args[0] || '';
  const cleanId = canId.replace(/^0x/i, '').toUpperCase();

  console.log('CAN ID:', cleanId);

  if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
    const target = cleanId.substring(4, 6);
    const source = cleanId.substring(6, 8);
    console.log(`ISO-TP addresses - Target: ${target}, Source: ${source}`);
  }
} else {
  console.log('✗ Regex does not match');
}