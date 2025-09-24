const fs = require('fs');
const path = require('path');

// Read and compile the TypeScript parser
const parserContent = fs.readFileSync('./src/lib/trace-parser.ts', 'utf8');

// Create a simple parseTraceFile function based on the TypeScript code
const parseTraceFile = (content) => {
  const messages = [];
  const ecus = new Map();
  const services = new Map();
  const procedures = [];
  const metadata = { startTime: null, endTime: null, duration: null };

  const lines = content.split('\n');
  console.log('Total lines in file:', lines.length);

  let parsedCount = 0;
  for (const line of lines) {
    if (line.includes('DATA') && line.includes('=>')) {
      parsedCount++;
    }
  }

  console.log('Lines with DATA =>:', parsedCount);

  return {
    messages,
    ecus,
    services,
    procedures,
    metadata
  };
};

// Test with Honda file
const traceFilePath = path.join('..', 'ExamplesForClaude', 'TraceLogsComplete', 'Honda', 'Jazz V', '2020', 'Camera Calibration', 'HONDA_JAZZ_CAM_RYDS.txt');
const content = fs.readFileSync(traceFilePath, 'utf8');

const result = parseTraceFile(content);
console.log('Messages parsed:', result.messages.length);
console.log('ECUs found:', result.ecus.size);