const fs = require('fs');

// Read one line from the Honda file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

// Find the first non-empty line with DATA
let testLine = null;
for (const line of lines) {
  if (line.includes('DATA')) {
    testLine = line;
    break;
  }
}

console.log('Test line (raw):', testLine);
console.log('Has &gt;:', testLine.includes('&gt;'));
console.log('Has &lt;:', testLine.includes('&lt;'));

// Decode HTML entities
const decoded = testLine
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&')
  .trim();

console.log('\nDecoded line:', decoded);

// Test the regex
const dataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/;
const match = decoded.match(dataRegex);

if (match) {
  console.log('\n✓ REGEX MATCHED!');
  console.log('Timestamp:', match[1]);
  console.log('Direction:', match[2] + '->' + match[3]);
  console.log('Module:', match[4]);
  console.log('Protocol:', match[5]);
  console.log('Command:', match[6]);
  console.log('Args:', match[7]);
  console.log('Data:', match[8]);
} else {
  console.log('\n✗ REGEX DID NOT MATCH');

  // Try to debug why
  console.log('\nChecking pattern parts:');
  console.log('Has timestamp?', /^[\d:\.]+/.test(decoded));
  console.log('Has pipe?', decoded.includes('|'));
  console.log('Has direction?', /\[([^\]]+)\]->\[([^\]]+)\]/.test(decoded));
  console.log('Has DATA =>?', decoded.includes('DATA =>'));
}