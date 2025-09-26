const fs = require('fs');
const path = require('path');

const TRACE_LOGS_DIR = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete';

function getAllTraceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllTraceFiles(filePath, fileList);
    } else if (file.endsWith('.txt')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Analyze the directory structure
const traceFiles = getAllTraceFiles(TRACE_LOGS_DIR);
const vehicleStructure = new Map();

traceFiles.forEach(filePath => {
  const relativePath = path.relative(TRACE_LOGS_DIR, filePath);
  const parts = relativePath.split(path.sep);

  // Structure is typically: OEM/Model/Year/JobType/filename.txt
  if (parts.length >= 3) {
    const oem = parts[0];
    const model = parts[1];
    const year = parts[2];

    const key = `${oem}|${model}|${year}`;
    if (!vehicleStructure.has(key)) {
      vehicleStructure.set(key, {
        oem,
        model,
        year,
        files: []
      });
    }
    vehicleStructure.get(key).files.push(path.basename(filePath));
  }
});

// Print the unique vehicle combinations
console.log('Unique Vehicle Combinations Found:');
console.log('=====================================\n');

const sortedEntries = Array.from(vehicleStructure.values()).sort((a, b) => {
  if (a.oem !== b.oem) return a.oem.localeCompare(b.oem);
  if (a.model !== b.model) return a.model.localeCompare(b.model);
  return a.year.localeCompare(b.year);
});

sortedEntries.forEach(vehicle => {
  console.log(`${vehicle.oem} → ${vehicle.model} → ${vehicle.year} (${vehicle.files.length} file${vehicle.files.length > 1 ? 's' : ''})`);
});

console.log(`\nTotal unique vehicle combinations: ${vehicleStructure.size}`);
console.log(`Total trace files: ${traceFiles.length}`);