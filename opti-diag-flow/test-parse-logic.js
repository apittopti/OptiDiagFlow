const fs = require('fs');

// Read the Honda trace file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);
console.log('First line (raw):', lines[0]);
console.log('First line length:', lines[0].length);
console.log('Second line (raw):', lines[1].substring(0, 150));

// Filter empty lines as the parser does
const filteredLines = lines.filter(line => line.trim());
console.log('\nFiltered lines:', filteredLines.length);
console.log('First filtered line:', filteredLines[0].substring(0, 150));

// Test parseLine logic on first actual data line
function testParseLine(line) {
  // Decode HTML entities
  const decodedLine = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

  if (!decodedLine) {
    console.log('Line is empty after decoding');
    return null;
  }

  console.log('\nDecoded line:', decodedLine.substring(0, 150));

  // Check for line number prefix
  let content = decodedLine;
  let lineNumber = 0;

  const lineNumMatch = decodedLine.match(/^(\d+)→(.*)$/);
  if (lineNumMatch) {
    lineNumber = parseInt(lineNumMatch[1]);
    content = lineNumMatch[2].trim();
    console.log('Found line number prefix:', lineNumber);
    console.log('Content after removing prefix:', content.substring(0, 150));
  }

  // Test the DATA regex
  const genericDataMatch = content.match(
    /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/
  );

  if (genericDataMatch) {
    console.log('\n✓ DATA REGEX MATCHED!');
    console.log('Captured groups:');
    genericDataMatch.forEach((group, i) => {
      if (i === 0) return; // Skip full match
      console.log(`  [${i}]: ${group}`);
    });

    // Extract addresses from CAN ID
    const args = genericDataMatch[7].split(',');
    const canId = args[0] || '';
    const cleanId = canId.replace(/^0x/i, '').toUpperCase();

    console.log('\nAddress extraction:');
    console.log('  CAN ID:', cleanId);

    const direction = genericDataMatch[2] + '->' + genericDataMatch[3];
    const isRequest = direction === 'Local->Remote';

    let sourceAddr = '';
    let targetAddr = '';

    if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
      const target = cleanId.substring(4, 6);
      const source = cleanId.substring(6, 8);

      console.log('  Extracted from CAN ID - Target:', target, 'Source:', source);

      if (isRequest) {
        sourceAddr = source; // F1 (tester)
        targetAddr = target; // B0 (ECU)
      } else {
        sourceAddr = source; // B0 (ECU)
        targetAddr = target; // F1 (tester)
      }

      console.log('  Final sourceAddr:', sourceAddr);
      console.log('  Final targetAddr:', targetAddr);
    }

    return {
      timestamp: genericDataMatch[1],
      direction: direction,
      protocol: genericDataMatch[5],
      messageId: genericDataMatch[6],
      sourceAddr: sourceAddr,
      targetAddr: targetAddr,
      data: genericDataMatch[8].replace(/^0x/i, '') || ''
    };
  } else {
    console.log('\n✗ DATA REGEX DID NOT MATCH');
  }

  return null;
}

console.log('\n=== TESTING FIRST DATA LINE ===');
const result = testParseLine(filteredLines[0]);
if (result) {
  console.log('\nParsed message:', result);
}