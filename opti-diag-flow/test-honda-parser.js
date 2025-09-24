const fs = require('fs');
const path = require('path');

// Import the parser directly
const { JifelineParser } = require('./src/lib/trace-parser/jifeline-parser');

// Read Honda trace file
const traceFile = path.join(__dirname, 'uploads/traces/1758523181232-dg93e-HONDA_JAZZ_CAM_RYDS.txt');
const content = fs.readFileSync(traceFile, 'utf8');

console.log('Testing Honda trace file parsing...\n');

// Parse the trace
const parser = new JifelineParser();
const result = parser.parseTrace(content);

console.log('Messages parsed:', result.messages.length);
console.log('ECUs discovered:', parser.getDiscoveredECUs().size);

// Show details for each ECU
const ecus = parser.getDiscoveredECUs();
for (const [addr, ecu] of ecus) {
  console.log('\nECU Address:', addr);
  console.log('  Name:', ecu.name);
  console.log('  Protocol:', ecu.protocol);
  console.log('  Services:', Array.from(ecu.discoveredServices));
  console.log('  Session Types:', Array.from(ecu.sessionTypes));
  console.log('  Security Levels:', Array.from(ecu.securityLevels));
  console.log('  DTCs:', ecu.discoveredDTCs.size);
  console.log('  DIDs:', ecu.discoveredDIDs.size);
  console.log('  Routines:', Array.from(ecu.discoveredRoutines.keys()));
  console.log('  Message count:', ecu.messageCount);
}

// Show sample messages
console.log('\nFirst 5 messages:');
result.messages.slice(0, 5).forEach((msg, i) => {
  console.log(`  ${i+1}. ${msg.timestamp} ${msg.direction} ${msg.protocol} ${msg.data}`);
});

// Check if UDS flow is captured
console.log('\nUDS Flow Check:');
const b0Ecu = ecus.get('B0');
if (b0Ecu) {
  console.log('  ECU B0 found');
  console.log('  Has Security Access (27)?', b0Ecu.discoveredServices.has('27'));
  console.log('  Has Session Control (10)?', b0Ecu.discoveredServices.has('10'));
  console.log('  Has Routine Control (31)?', b0Ecu.discoveredServices.has('31'));
} else {
  console.log('  ECU B0 not found!');
}