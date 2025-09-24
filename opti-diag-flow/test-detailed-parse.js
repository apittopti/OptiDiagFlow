const fs = require('fs');

// Read one line from the Honda file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

// Find the first DATA line
let testLine = null;
for (const line of lines) {
  if (line.includes('DATA')) {
    testLine = line;
    break;
  }
}

console.log('Original line:', testLine);

// Decode HTML entities
const decodedLine = testLine
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&')
  .trim();

console.log('\nDecoded line:', decodedLine);

// Test the full regex
const dataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/;
const match = decodedLine.match(dataRegex);

if (match) {
  console.log('\n✓ REGEX MATCHED!');
  console.log('Groups extracted:');
  console.log('  [1] Timestamp:', match[1]);
  console.log('  [2] From direction:', match[2]);
  console.log('  [3] To direction:', match[3]);
  console.log('  [4] Module:', match[4]);
  console.log('  [5] Protocol:', match[5]);
  console.log('  [6] Command:', match[6]);
  console.log('  [7] Args:', match[7]);
  console.log('  [8] Data:', match[8]);

  // Now test address extraction logic
  const args = match[7].split(',');
  const canId = args[0] || '';
  const cleanId = canId.replace(/^0x/i, '').toUpperCase();
  const data = match[8].replace(/^0x/i, '');

  console.log('\nAddress extraction:');
  console.log('  CAN ID (raw):', canId);
  console.log('  CAN ID (clean):', cleanId);
  console.log('  Data:', data);

  const direction = match[2] + '->' + match[3];
  const isRequest = direction === 'Local->Remote';
  console.log('  Direction:', direction);
  console.log('  Is Request:', isRequest);

  // Test the ISO-TP pattern
  if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
    console.log('  ✓ Matches ISO-TP pattern!');
    const target = cleanId.substring(4, 6);
    const source = cleanId.substring(6, 8);
    console.log('  Target from ID:', target);
    console.log('  Source from ID:', source);

    let sourceAddr, targetAddr;
    if (isRequest) {
      sourceAddr = source; // F1 (tester)
      targetAddr = target; // B0 (ECU)
    } else {
      sourceAddr = source; // B0 (ECU)
      targetAddr = target; // F1 (tester)
    }

    console.log('\n  Final addresses:');
    console.log('    sourceAddr:', sourceAddr);
    console.log('    targetAddr:', targetAddr);

    // This is what should be returned in the message object:
    const returnedMessage = {
      timestamp: match[1],
      direction: direction,
      protocol: match[5],
      messageId: match[6],
      sourceAddr: sourceAddr,
      targetAddr: targetAddr,
      data: match[8].replace(/^0x/i, '') || '',
      metadata: {
        module: match[4],
        canId: canId,
        args: args
      }
    };

    console.log('\nFull message object that should be returned:');
    console.log(JSON.stringify(returnedMessage, null, 2));
  } else {
    console.log('  ✗ Does not match ISO-TP pattern');
  }
} else {
  console.log('\n✗ REGEX DID NOT MATCH');
}