const fs = require('fs');
const path = require('path');

// Read Honda trace file
const traceFile = path.join(__dirname, 'uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt');
const content = fs.readFileSync(traceFile, 'utf8');

// Parse a few lines manually to check the format
const lines = content.split('\n').slice(0, 20);

console.log('First 20 lines of Honda trace:\n');
lines.forEach((line, i) => {
  if (line.includes('HONDA ISOTP')) {
    console.log(`Line ${i}: ${line}`);

    // Extract the CAN ID from args
    const match = line.match(/\[(0x[0-9A-Fa-f]+)\]/);
    if (match) {
      const canId = match[1].replace(/^0x/i, '').toUpperCase();
      if (canId.startsWith('18DA')) {
        const target = canId.slice(4, 6);
        const source = canId.slice(6, 8);
        console.log(`  -> CAN ID: ${canId}, Target: ${target}, Source: ${source}`);

        // Check direction
        if (line.includes('Local->Remote')) {
          console.log(`  -> Tester (${source}) to ECU (${target})`);
        } else if (line.includes('Remote->Local')) {
          console.log(`  -> ECU (${source}) to Tester (${target})`);
        }
      }
    }
    console.log('');
  }
});