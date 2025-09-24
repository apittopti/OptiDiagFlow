const fs = require('fs');

// Read the Honda file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

// Test the regex patterns
const dataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/;
const metadataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+(\w+)\s*=>\s*key\[([^\]]+)\]\s*value\[([^\]]+)\]/;

let dataMessages = 0;
let metadataMessages = 0;
let otherMessages = 0;
let emptyLines = 0;

lines.forEach((line, index) => {
  const decoded = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

  if (!decoded) {
    emptyLines++;
    return;
  }

  if (dataRegex.test(decoded)) {
    dataMessages++;
  } else if (metadataRegex.test(decoded)) {
    metadataMessages++;
  } else {
    otherMessages++;
    if (index < 10) {
      console.log(`Other line ${index}: ${decoded.substring(0, 100)}`);
    }
  }
});

console.log('\n=== LINE ANALYSIS ===');
console.log('DATA messages:', dataMessages);
console.log('METADATA messages:', metadataMessages);
console.log('Other messages:', otherMessages);
console.log('Empty lines:', emptyLines);

// Test the first DATA message in detail
console.log('\n=== TESTING FIRST DATA MESSAGE ===');
for (const line of lines) {
  const decoded = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

  if (!decoded) continue;

  const match = decoded.match(dataRegex);
  if (match) {
    console.log('First DATA line:', decoded);

    const args = match[7].split(',');
    const canId = args[0] || '';
    const cleanId = canId.replace(/^0x/i, '').toUpperCase();

    console.log('CAN ID:', cleanId);

    if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
      const target = cleanId.substring(4, 6);
      const source = cleanId.substring(6, 8);
      const direction = match[2] + '->' + match[3];
      const isRequest = direction === 'Local->Remote';

      let sourceAddr, targetAddr;
      if (isRequest) {
        sourceAddr = source; // F1
        targetAddr = target; // B0
      } else {
        sourceAddr = source; // B0
        targetAddr = target; // F1
      }

      console.log('Extracted addresses:');
      console.log('  sourceAddr:', sourceAddr);
      console.log('  targetAddr:', targetAddr);
    }
    break;
  }
}