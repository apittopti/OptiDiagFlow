const fs = require('fs');

// Read the uploaded Honda file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');
const lines = content.split('\n');

console.log('=== PARSER DEBUG ===');
console.log('Total lines:', lines.length);
console.log('\n=== FIRST 5 LINES (RAW) ===');
lines.slice(0, 5).forEach((line, i) => {
  console.log(`Line ${i}: ${line.substring(0, 150)}`);
});

// Test the regex pattern on actual data
const testLine = lines[0];
console.log('\n=== TESTING REGEX ON FIRST LINE ===');
console.log('Line:', testLine);

// Decode HTML entities
const decodedLine = testLine
  .replace(/&gt;/g, '>')
  .replace(/&lt;/g, '<')
  .replace(/&amp;/g, '&')
  .trim();

console.log('Decoded:', decodedLine);

// Test the main DATA regex
const dataRegex = /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]*)\]/;
const match = decodedLine.match(dataRegex);

if (match) {
  console.log('\n=== REGEX MATCH SUCCESS ===');
  console.log('Timestamp:', match[1]);
  console.log('From:', match[2]);
  console.log('To:', match[3]);
  console.log('Module:', match[4]);
  console.log('Protocol:', match[5]);
  console.log('Command:', match[6]);
  console.log('Args:', match[7]);
  console.log('Data:', match[8]);

  // Extract addresses from CAN ID
  const args = match[7].split(',');
  const canId = args[0] || '';
  const cleanId = canId.replace(/^0x/i, '').toUpperCase();
  console.log('\n=== ADDRESS EXTRACTION ===');
  console.log('CAN ID:', cleanId);

  if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
    const target = cleanId.substring(4, 6);
    const source = cleanId.substring(6, 8);
    console.log('Target address in ID:', target);
    console.log('Source address in ID:', source);

    const direction = match[2] + '->' + match[3];
    const isRequest = direction === 'Local->Remote';

    let sourceAddr, targetAddr;
    if (isRequest) {
      sourceAddr = source; // F1 (tester)
      targetAddr = target; // B0 (ECU)
    } else {
      sourceAddr = source; // B0 (ECU)
      targetAddr = target; // F1 (tester)
    }

    console.log('Direction:', direction);
    console.log('Is Request:', isRequest);
    console.log('Final Source Address:', sourceAddr);
    console.log('Final Target Address:', targetAddr);
  }
} else {
  console.log('\n=== REGEX MATCH FAILED ===');
}

// Count messages with different patterns
console.log('\n=== MESSAGE ANALYSIS ===');
let dataMessages = 0;
let metadataMessages = 0;
const ecuSet = new Set();
const serviceSet = new Set();

lines.forEach(line => {
  const decoded = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();

  if (decoded.includes('DATA =>')) {
    dataMessages++;

    const match = decoded.match(dataRegex);
    if (match) {
      const args = match[7].split(',');
      const canId = args[0] || '';
      const cleanId = canId.replace(/^0x/i, '').toUpperCase();
      const data = match[8].replace(/^0x/i, '');

      // Extract addresses
      if (cleanId.match(/^18DA[0-9A-F]{4}$/)) {
        const target = cleanId.substring(4, 6);
        const source = cleanId.substring(6, 8);

        const direction = match[2] + '->' + match[3];
        const isRequest = direction === 'Local->Remote';

        if (isRequest) {
          ecuSet.add(target); // ECU address
        } else {
          ecuSet.add(source); // ECU address
        }
      }

      // Extract service ID from data
      if (data.length >= 2) {
        const serviceId = data.substring(0, 2);
        serviceSet.add(serviceId);
      }
    }
  } else if (decoded.includes('METADATA')) {
    metadataMessages++;
  }
});

console.log('DATA messages:', dataMessages);
console.log('METADATA messages:', metadataMessages);
console.log('Unique ECU addresses found:', Array.from(ecuSet).join(', '));
console.log('Total unique ECUs:', ecuSet.size);
console.log('Unique service IDs:', Array.from(serviceSet).slice(0, 10).join(', ') + '...');

// Filter out tester addresses
const testerAddrs = ['F1', 'F0', 'FD', 'FE', 'FF', '0E80', 'TESTER'];
const realEcus = Array.from(ecuSet).filter(addr => !testerAddrs.includes(addr.toUpperCase()));
console.log('\n=== FINAL RESULTS ===');
console.log('Real ECUs (non-tester):', realEcus.join(', '));
console.log('ECU count:', realEcus.length);