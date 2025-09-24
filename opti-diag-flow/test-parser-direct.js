const fs = require('fs');

// Import the actual parser
const parserPath = './src/lib/trace-parser.ts';
const parserCode = fs.readFileSync(parserPath, 'utf8');

// Extract the parseLine function logic manually
function parseLine(line) {
  const decodedLine = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

  if (!decodedLine) return null;

  const content = decodedLine;

  // Parse DATA messages
  const genericDataMatch = content.match(
    /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/
  );

  if (genericDataMatch) {
    const args = genericDataMatch[7].split(',');
    const canId = args[0] || '';
    const cleanId = canId.replace(/^0x/i, '').toUpperCase();
    const data = genericDataMatch[8].replace(/^0x/i, '');

    let sourceAddr = '';
    let targetAddr = '';

    const direction = genericDataMatch[2] + '->' + genericDataMatch[3];
    const isRequest = direction === 'Local->Remote';

    // ISO-TP Extended CAN ID (29-bit) - 18DAxxYY format
    if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
      const target = cleanId.substring(4, 6);
      const source = cleanId.substring(6, 8);

      // THIS IS THE KEY FIX: Use isRequest to determine actual flow
      if (isRequest) {
        // Local->Remote: Tester sending to ECU
        sourceAddr = source; // F1
        targetAddr = target; // B0
      } else {
        // Remote->Local: ECU responding to Tester
        sourceAddr = source; // B0
        targetAddr = target; // F1
      }
    }

    return {
      timestamp: genericDataMatch[1],
      direction: direction,
      protocol: genericDataMatch[5],
      sourceAddr,
      targetAddr,
      data,
      canId: cleanId
    };
  }

  return null;
}

// Test with Honda log
const hondaLog = fs.readFileSync('../ExamplesForClaude/TraceLogsComplete/Honda/Jazz V/2020/Camera Calibration/HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = hondaLog.split('\n').slice(0, 20);

const messages = [];
const ecus = new Set();

for (const line of lines) {
  const msg = parseLine(line);
  if (msg) {
    messages.push(msg);

    // Track unique addresses
    if (msg.sourceAddr) ecus.add(msg.sourceAddr);
    if (msg.targetAddr) ecus.add(msg.targetAddr);

    console.log(`${msg.timestamp}: ${msg.sourceAddr} -> ${msg.targetAddr} | ${msg.data.substring(0, 10)}...`);
  }
}

console.log('\n=== Summary ===');
console.log('Messages parsed:', messages.length);
console.log('Unique addresses found:', Array.from(ecus).join(', '));

// Filter out tester addresses
const testerAddrs = ['F1', 'F0', 'FD', 'FE', 'FF', '0E80', 'TESTER'];
const ecuAddrs = Array.from(ecus).filter(addr => !testerAddrs.includes(addr.toUpperCase()));
console.log('ECU addresses (non-tester):', ecuAddrs.join(', '));
console.log('Tester addresses:', Array.from(ecus).filter(addr => testerAddrs.includes(addr.toUpperCase())).join(', '));