const fs = require('fs');
const path = require('path');

// Directory containing trace files
const traceDir = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete';

// Object to store all metadata patterns
const metadataPatterns = {
  connection: new Set(),
  vehicle: new Set(),
  ticket: new Set(),
  connectors: new Set(),
  ecu: new Set(),
  other: new Set()
};

// Statistics
const stats = {
  totalFiles: 0,
  totalMetadataLines: 0,
  filesByOEM: {},
  voltageReadings: [],
  uniqueKeys: new Set()
};

// Function to recursively find all .txt files
function findTraceFiles(dir) {
  const files = [];

  function walk(currentPath) {
    try {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (item.endsWith('.txt')) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      console.error(`Error reading ${currentPath}: ${err.message}`);
    }
  }

  walk(dir);
  return files;
}

// Function to analyze a single trace file
function analyzeTraceFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Extract OEM from path
  const pathParts = filePath.split(path.sep);
  const oemIndex = pathParts.indexOf('TraceLogsComplete') + 1;
  const oem = pathParts[oemIndex] || 'Unknown';

  stats.filesByOEM[oem] = (stats.filesByOEM[oem] || 0) + 1;

  let fileMetadata = {
    path: filePath,
    oem: oem,
    model: pathParts[oemIndex + 1] || 'Unknown',
    year: pathParts[oemIndex + 2] || 'Unknown',
    metadataCount: 0,
    uniqueKeys: new Set(),
    voltage: [],
    protocols: new Set()
  };

  for (const line of lines) {
    // Check for METADATA lines (handle both => and =&gt; formats)
    if (line.includes('METADATA') && (line.includes('=>') || line.includes('=&gt;'))) {
      stats.totalMetadataLines++;
      fileMetadata.metadataCount++;

      // Extract key and value
      const keyMatch = line.match(/key\[([^\]]+)\]/);
      const valueMatch = line.match(/value\[([^\]]+)\]/);

      if (keyMatch) {
        const key = keyMatch[1];
        const value = valueMatch ? valueMatch[1] : '';

        stats.uniqueKeys.add(key);
        fileMetadata.uniqueKeys.add(key);

        // Categorize the metadata
        if (key.startsWith('connection:')) {
          metadataPatterns.connection.add(key);
        } else if (key.startsWith('vehicle:')) {
          metadataPatterns.vehicle.add(key);

          // Track voltage readings
          if (key === 'vehicle:info:voltage' && value) {
            const voltage = parseFloat(value);
            if (!isNaN(voltage)) {
              stats.voltageReadings.push({ oem, voltage, file: path.basename(filePath) });
              fileMetadata.voltage.push(voltage);
            }
          }
        } else if (key.startsWith('ticket:')) {
          metadataPatterns.ticket.add(key);
        } else if (key.startsWith('connectors:')) {
          // Extract connector metric type
          const parts = key.split(':');
          if (parts.length >= 3) {
            const metricType = parts.slice(2).join(':');
            metadataPatterns.connectors.add(metricType);
          }
        } else if (key.startsWith('ecu:')) {
          metadataPatterns.ecu.add(key);
        } else {
          metadataPatterns.other.add(key);
        }
      }
    }

    // Check for protocol information
    if (line.includes('DOIP') || line.includes('DoIP')) {
      fileMetadata.protocols.add('DoIP');
    }
    if (line.includes('ISOTP') || line.includes('ISO-TP')) {
      fileMetadata.protocols.add('ISO-TP');
    }
    if (line.includes('HONDA')) {
      fileMetadata.protocols.add('HONDA ISOTP');
    }
    if (line.includes('HYUNDAI') || line.includes('KIA')) {
      fileMetadata.protocols.add('HYUNDAI/KIA ISOTP');
    }
  }

  return fileMetadata;
}

// Main analysis
console.log('Analyzing trace files for metadata patterns...\n');

const traceFiles = findTraceFiles(traceDir);
stats.totalFiles = traceFiles.length;

console.log(`Found ${traceFiles.length} trace files\n`);

const fileAnalysis = [];
for (const file of traceFiles) {
  console.log(`Analyzing: ${path.basename(file)}`);
  const analysis = analyzeTraceFile(file);
  fileAnalysis.push(analysis);
}

// Generate report
console.log('\n' + '='.repeat(80));
console.log('METADATA PATTERNS ANALYSIS REPORT');
console.log('='.repeat(80));

console.log('\n📊 OVERALL STATISTICS:');
console.log(`  Total files analyzed: ${stats.totalFiles}`);
console.log(`  Total metadata lines: ${stats.totalMetadataLines}`);
console.log(`  Unique metadata keys: ${stats.uniqueKeys.size}`);

console.log('\n🚗 FILES BY OEM:');
for (const [oem, count] of Object.entries(stats.filesByOEM)) {
  console.log(`  ${oem}: ${count} file(s)`);
}

console.log('\n🔌 CONNECTION METADATA KEYS:');
for (const key of Array.from(metadataPatterns.connection).sort()) {
  console.log(`  - ${key}`);
}

console.log('\n🚙 VEHICLE METADATA KEYS:');
for (const key of Array.from(metadataPatterns.vehicle).sort()) {
  console.log(`  - ${key}`);
}

console.log('\n🎫 TICKET METADATA KEYS:');
for (const key of Array.from(metadataPatterns.ticket).sort()) {
  console.log(`  - ${key}`);
}

console.log('\n🔗 CONNECTOR METRICS:');
for (const metric of Array.from(metadataPatterns.connectors).sort()) {
  console.log(`  - ${metric}`);
}

console.log('\n🖥️ ECU METADATA KEYS:');
for (const key of Array.from(metadataPatterns.ecu).sort()) {
  console.log(`  - ${key}`);
}

if (metadataPatterns.other.size > 0) {
  console.log('\n❓ OTHER METADATA KEYS:');
  for (const key of Array.from(metadataPatterns.other).sort()) {
    console.log(`  - ${key}`);
  }
}

console.log('\n⚡ VOLTAGE READINGS SUMMARY:');
const voltageByOEM = {};
for (const reading of stats.voltageReadings) {
  if (!voltageByOEM[reading.oem]) {
    voltageByOEM[reading.oem] = [];
  }
  voltageByOEM[reading.oem].push(reading.voltage);
}

for (const [oem, voltages] of Object.entries(voltageByOEM)) {
  const min = Math.min(...voltages);
  const max = Math.max(...voltages);
  const avg = (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(2);
  console.log(`  ${oem}: Min=${min}V, Max=${max}V, Avg=${avg}V (${voltages.length} readings)`);
}

console.log('\n📝 FILE-BY-FILE SUMMARY:');
for (const file of fileAnalysis) {
  console.log(`\n  ${file.oem} ${file.model} ${file.year}:`);
  console.log(`    File: ${path.basename(file.path)}`);
  console.log(`    Metadata lines: ${file.metadataCount}`);
  console.log(`    Unique keys: ${file.uniqueKeys.size}`);
  console.log(`    Protocols: ${Array.from(file.protocols).join(', ') || 'Not detected'}`);
  if (file.voltage.length > 0) {
    console.log(`    Voltage: ${Math.min(...file.voltage)}V - ${Math.max(...file.voltage)}V`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('Analysis complete!');