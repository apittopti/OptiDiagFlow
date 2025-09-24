const fs = require('fs');
const path = require('path');

// Trace files to analyze
const traceFiles = [
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Honda\\Jazz V\\2020\\Camera Calibration\\HONDA_JAZZ_CAM_RYDS.txt',
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Hyundai\\i20\\2021\\Camera Calibration\\8882747.txt',
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Landrover\\Defender\\2020\\Camera Calibration\\8873778.txt',
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Nissan\\Qashqai\\2022\\Camera Calibration\\8882943.txt',
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Polestar\\Polestar 2\\2022\\Camera calibration\\8875011.txt',
  'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete\\Toyota\\Yaris\\2024\\Camera Calibration\\8885638.txt'
];

function analyzeTraceFile(filePath) {
  const manufacturer = path.basename(path.dirname(path.dirname(path.dirname(path.dirname(filePath)))));
  console.log(`\n=== ${manufacturer} ===`);
  console.log(`File: ${path.basename(filePath)}`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // Find sample DATA and DOIP messages
    let dataLines = [];
    let doipLines = [];
    let otherProtocols = new Set();

    for (let i = 0; i < Math.min(lines.length, 500); i++) {
      const line = lines[i]
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');

      if (line.includes('DATA =>') && dataLines.length < 3) {
        dataLines.push(line);

        // Extract protocol info
        const protocolMatch = line.match(/\[([^\]]+)\]\s*cmd\[/);
        if (protocolMatch) {
          otherProtocols.add(protocolMatch[1]);
        }
      }

      if (line.includes('DOIP =>') && doipLines.length < 3) {
        doipLines.push(line);
        otherProtocols.add('DoIP');
      }
    }

    console.log('Protocols found:', Array.from(otherProtocols));

    if (dataLines.length > 0) {
      console.log('\nSample DATA lines:');
      dataLines.forEach((line, i) => {
        console.log(`  ${i+1}: ${line.substring(0, 200)}`);

        // Analyze CAN IDs
        const canIdMatch = line.match(/args\[([^\]]+)\]/);
        if (canIdMatch) {
          const args = canIdMatch[1].split(',');
          const canId = args[0].replace(/^0x/i, '').toUpperCase();
          console.log(`     CAN ID: ${canId}`);

          if (canId.startsWith('18DA')) {
            const target = canId.substring(4, 6);
            const source = canId.substring(6, 8);
            console.log(`     ISO-TP: Target=${target}, Source=${source}`);
          }
        }
      });
    }

    if (doipLines.length > 0) {
      console.log('\nSample DOIP lines:');
      doipLines.forEach((line, i) => {
        console.log(`  ${i+1}: ${line.substring(0, 200)}`);
      });
    }

  } catch (error) {
    console.log(`Error reading file: ${error.message}`);
  }
}

// Analyze all files
console.log('=== ANALYZING TRACE FILE FORMATS ===\n');
traceFiles.forEach(analyzeTraceFile);