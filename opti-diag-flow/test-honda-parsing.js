const fs = require('fs');

// Load Honda trace file
const content = fs.readFileSync('../ExamplesForClaude/TraceLogsComplete/Honda/Jazz V/2020/Camera Calibration/HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n').slice(0, 20);

console.log('Honda ISOTP Parsing Debug');
console.log('=========================\n');

for (let line of lines.slice(0, 10)) {
  // Decode HTML entities
  line = line.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

  console.log('Original line:', line);

  // Parse DATA message
  const dataMatch = line.match(
    /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/
  );

  if (dataMatch) {
    const timestamp = dataMatch[1];
    const direction = dataMatch[2] + '->' + dataMatch[3];
    const protocol = dataMatch[5];
    const args = dataMatch[7].split(',');
    const canId = args[0] || '';
    const cleanId = canId.replace(/^0x/i, '').toUpperCase();
    const data = dataMatch[8].replace(/^0x/i, '');

    console.log('  Parsed:');
    console.log('    Direction:', direction);
    console.log('    CAN ID:', cleanId);
    console.log('    Data:', data);

    // Extract addresses from CAN ID
    let sourceAddr = '';
    let targetAddr = '';

    if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
      // ISO-TP Extended format: 18DAxxYY
      // xx = target (physical addressing)
      // YY = source
      const target = cleanId.substring(4, 6);
      const source = cleanId.substring(6, 8);

      console.log('    Extracted from CAN ID:');
      console.log('      Target in ID:', target);
      console.log('      Source in ID:', source);

      // For Honda, the direction tells us the actual flow
      if (direction === 'Local->Remote') {
        // Tester sending to ECU
        sourceAddr = source; // F1 (tester)
        targetAddr = target; // B0 (ECU)
      } else {
        // ECU responding to tester
        sourceAddr = target; // B0 (ECU)
        targetAddr = source; // F1 (tester)
      }
    }

    console.log('    Final addresses:');
    console.log('      Source:', sourceAddr || 'NOT SET');
    console.log('      Target:', targetAddr || 'NOT SET');

    // Extract service code
    const serviceCode = data.substring(0, 2).toUpperCase();
    console.log('    Service code:', serviceCode);

    // Check if it's a response
    const isResponse = serviceCode.match(/^[567][0-9A-F]$/) || serviceCode === '7F';
    console.log('    Is response?', isResponse);
  }

  console.log('---');
}