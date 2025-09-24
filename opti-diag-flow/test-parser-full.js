const fs = require('fs');

// Load the actual TypeScript parser by transpiling on the fly
const ts = fs.readFileSync('./src/lib/trace-parser.ts', 'utf8');

// Simple transpile - remove TypeScript syntax
const js = ts
  .replace(/export function/g, 'function')
  .replace(/export const/g, 'const')
  .replace(/: string\[\]/g, '')
  .replace(/: string/g, '')
  .replace(/: number/g, '')
  .replace(/: boolean/g, '')
  .replace(/: any/g, '')
  .replace(/: Date/g, '')
  .replace(/: DoipTraceMessage\[\]/g, '')
  .replace(/: Map<[^>]+>/g, '')
  .replace(/: Record<[^>]+>/g, '')
  .replace(/: \w+Info/g, '')
  .replace(/: \w+\[\]/g, '')
  .replace(/: \w+/g, '')
  .replace(/interface \w+[^}]+}/gs, '')
  .replace(/type \w+[^;]+;/g, '')
  .replace(/enum \w+[^}]+}/gs, '')
  .replace(/<[^>]+>/g, '')
  .replace(/as any/g, '')
  .replace(/\?\./g, '.')
  .replace(/\?\?\s/g, '|| ')
  .replace(/Map/g, 'Map')
  .replace(/Date/g, 'Date')
  .replace(/Set/g, 'Set');

// Evaluate the parser code
eval(js);

// Now test with the Honda file
const content = fs.readFileSync('./uploads/traces/1758479947075-224hx-HONDA_JAZZ_CAM_RYDS.txt', 'utf8');

console.log('=== TESTING FULL PARSER ===');
const result = parseTraceFile(content);

console.log('Messages parsed:', result.messages.length);
console.log('ECUs found:', result.ecus.size);
console.log('ECU addresses:', Array.from(result.ecus.keys()));
console.log('Services found:', result.services.size);
console.log('Procedures found:', result.procedures.length);

// Filter out tester addresses
const testerAddresses = new Set(['F1', 'F0', 'FD', 'FE', 'FF', '0E80', 'TESTER']);
const ecuAddresses = Array.from(result.ecus.keys())
  .filter(addr => !testerAddresses.has(addr.toUpperCase()));

console.log('\n=== FILTERED RESULTS ===');
console.log('Real ECUs (non-tester):', ecuAddresses);
console.log('Real ECU count:', ecuAddresses.length);

// Check for DTCs
console.log('\n=== DIAGNOSTIC DATA ===');
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

console.log('DTCs found:', Array.from(dtcs));
console.log('DIDs found:', Array.from(dids));
console.log('Routines found:', Array.from(routines));

// Check a few messages to see if addresses are being parsed
console.log('\n=== SAMPLE MESSAGES ===');
result.messages.slice(0, 5).forEach((msg, i) => {
  console.log(`Message ${i}: ${msg.sourceAddr} -> ${msg.targetAddr} | Service: ${msg.data?.substring(0, 2)}`);
});