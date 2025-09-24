import { parseTraceFile } from './src/lib/trace-parser.ts';
import fs from 'fs';

// Read the Honda trace file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');

console.log('=== TESTING PROTOCOL-AGNOSTIC PARSER ===');
const result = parseTraceFile(content);

console.log('\n=== PARSER RESULTS ===');
console.log('Messages parsed:', result.messages.length);
console.log('ECUs found:', result.ecus.size);
console.log('ECU addresses:', Array.from(result.ecus.keys()));
console.log('Services found:', result.services.size);
console.log('Procedures found:', result.procedures.length);

// Filter out tester addresses
const testerAddresses = new Set(['F1', 'F0', 'FD', 'FE', 'FF', '0E80', 'TESTER']);
const ecuAddresses = Array.from(result.ecus.keys())
  .filter(addr => !testerAddresses.has(addr.toUpperCase()));

console.log('\n=== REAL ECUS (NON-TESTER) ===');
ecuAddresses.forEach(addr => {
  const ecu = result.ecus.get(addr);
  console.log(`ECU ${addr}: Sent=${ecu.messagesSent}, Received=${ecu.messagesReceived}`);
});
console.log('Total real ECUs:', ecuAddresses.length);

// Check for diagnostic data
console.log('\n=== EXTRACTED DIAGNOSTIC DATA ===');
const dtcs = new Set();
const dids = new Set();
const routines = new Set();

result.procedures.forEach(procedure => {
  if (procedure.extractedData?.dtcs) {
    procedure.extractedData.dtcs.forEach(dtc => dtcs.add(dtc));
  }
  if (procedure.extractedData?.dataIdentifiers) {
    Object.keys(procedure.extractedData.dataIdentifiers).forEach(did => dids.add(did));
  }
  if (procedure.procedureType === 'routine_control') {
    routines.add(procedure.procedureName);
  }
});

console.log('DTCs found:', dtcs.size, Array.from(dtcs).slice(0, 5));
console.log('DIDs found:', dids.size, Array.from(dids).slice(0, 5));
console.log('Routines found:', routines.size, Array.from(routines).slice(0, 5));

// Check sample messages to verify protocol detection
console.log('\n=== SAMPLE MESSAGES WITH PROTOCOLS ===');
result.messages.slice(0, 10).forEach((msg, i) => {
  console.log(`${i}: [${msg.protocol}] ${msg.sourceAddr} -> ${msg.targetAddr} | Data: ${msg.data?.substring(0, 10)}`);
});