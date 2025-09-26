const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:6001';
// Scan all subdirectories in ExamplesForClaude for trace files
const EXAMPLES_DIR = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude';

// Dynamic OEM name normalization
// Add new mappings here as needed, or it will use the directory name as-is
const OEM_NORMALIZATIONS = {
  'landrover': 'Land Rover',
  'land rover': 'Land Rover',
  'mercedes': 'Mercedes-Benz',
  'mercedes-benz': 'Mercedes-Benz',
  'vw': 'Volkswagen',
  'volkswagen': 'Volkswagen'
};

function normalizeOemName(dirName) {
  // Check if we have a specific normalization
  const lowerName = dirName.toLowerCase();
  if (OEM_NORMALIZATIONS[lowerName]) {
    return OEM_NORMALIZATIONS[lowerName];
  }

  // Otherwise, capitalize first letter of each word
  return dirName
    .split(/[\s-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function getAllTraceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      await getAllTraceFiles(filePath, fileList);
    } else if (file.endsWith('.txt')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function getOrCreateVehicleModelYear(oemName, modelName, year) {
  try {
    // First, get the vehicle hierarchy
    const hierarchyResponse = await fetch(`${API_BASE_URL}/api/vehicles/hierarchy`);
    const hierarchy = await hierarchyResponse.json();

    // Find or create OEM
    let oem = hierarchy.find(o => o.name === oemName || o.shortName === oemName.toUpperCase());
    if (!oem) {
      oem = hierarchy.find(o => o.Model && (o.name === oemName || o.shortName === oemName.toUpperCase()));
    }

    if (!oem) {
      console.log(`  Creating OEM: ${oemName}`);
      const oemResponse = await fetch(`${API_BASE_URL}/api/oems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: oemName, country: 'Unknown' })
      });
      if (!oemResponse.ok) {
        throw new Error(`Failed to create OEM: ${await oemResponse.text()}`);
      }
      const newOem = await oemResponse.json();
      oem = { id: newOem.id, name: oemName, Model: [] };
    }

    // Find or create Model
    const models = oem.Model || oem.models || [];
    let model = models.find(m => m.name === modelName);

    if (!model) {
      console.log(`  Creating Model: ${modelName} for ${oemName}`);
      const code = `${oemName.toUpperCase()}_${modelName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
      const modelResponse = await fetch(`${API_BASE_URL}/api/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelName,
          oemId: oem.id,
          code: code,
          platform: null
        })
      });
      if (!modelResponse.ok) {
        throw new Error(`Failed to create Model: ${await modelResponse.text()}`);
      }
      const newModel = await modelResponse.json();
      model = { id: newModel.id, name: modelName, ModelYear: [] };
    }

    // Find or create ModelYear
    const modelYears = model.ModelYear || model.modelYears || [];
    let modelYear = modelYears.find(my => my.year === year);

    if (!modelYear) {
      console.log(`  Creating ModelYear: ${year} for ${modelName}`);
      const modelYearResponse = await fetch(`${API_BASE_URL}/api/model-years`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, modelId: model.id })
      });
      if (!modelYearResponse.ok) {
        throw new Error(`Failed to create ModelYear: ${await modelYearResponse.text()}`);
      }
      modelYear = await modelYearResponse.json();
    }

    return modelYear.id;
  } catch (error) {
    console.error(`Error getting/creating vehicle for ${oemName} ${modelName} ${year}:`, error);
    return null;
  }
}

async function processTraceFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(EXAMPLES_DIR, filePath);
    const pathParts = relativePath.split(path.sep);

    // Skip files not in a proper structure (need at least TraceLogs*/OEM/Model/...)
    // Looking for TraceLogs or TraceLogsComplete as the first directory
    let startIndex = -1;
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i].toLowerCase().includes('tracelogs')) {
        startIndex = i + 1;
        break;
      }
    }

    if (startIndex === -1 || startIndex >= pathParts.length - 1) {
      console.log(`  Skipping file not in TraceLogs structure: ${relativePath}`);
      return false;
    }

    // Extract from TraceLogs*/OEM/Model/Year/[JobType]/[JobFolder]/filename.txt
    const relevantParts = pathParts.slice(startIndex);

    if (relevantParts.length < 2) {
      console.error(`  Invalid path structure: ${relativePath}`);
      return false;
    }

    const oemDir = relevantParts[0];
    const model = relevantParts[1];
    let year = null;
    let jobType = null;
    let jobFolder = null;

    // Try to find a year in the relevant parts (4-digit number between 1990 and 2050)
    for (let i = 2; i < relevantParts.length; i++) {
      const part = relevantParts[i];
      const potentialYear = parseInt(part);
      if (!isNaN(potentialYear) && potentialYear >= 1990 && potentialYear <= 2050) {
        year = potentialYear;

        // Get job type if it exists (next folder after year)
        // This is the procedure type (e.g., "Camera Calibration", "Dynamic Front Camera Calibration")
        if (i + 1 < relevantParts.length - 1) {
          jobType = relevantParts[i + 1];

          // Check if there's a job folder (like "JOB-EA25MUB")
          if (i + 2 < relevantParts.length - 1) {
            jobFolder = relevantParts[i + 2];
          }
        }
        break;
      }
    }

    // If no year found in path, check if the filename starts with a year
    if (!year && fileName.match(/^(19|20)\d{2}/)) {
      year = parseInt(fileName.substring(0, 4));
    }

    // Default to current year if still no year found
    if (!year) {
      year = new Date().getFullYear();
      console.log(`  Warning: No year found in path, using current year: ${year}`);
    }

    // Normalize the OEM name dynamically
    const oemName = normalizeOemName(oemDir);

    console.log(`\nProcessing: ${fileName}`);
    console.log(`  OEM: ${oemName}, Model: ${model}, Year: ${year}`);
    if (jobType) {
      console.log(`  Procedure: ${jobType}`);
    }

    // Get or create the correct vehicle model year
    const modelYearId = await getOrCreateVehicleModelYear(oemName, model, parseInt(year));

    if (!modelYearId) {
      console.error(`  ✗ Failed to get/create vehicle for ${fileName}`);
      return false;
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jobName = fileName.replace('.txt', '').replace(/^\d{13}-[a-z0-9]+-/, '');

    // Create unique filename for upload
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const uploadFileName = `${timestamp}-${randomId}-${fileName}`;

    // Ensure uploads directory exists
    const uploadDir = path.join(__dirname, '../../uploads/traces');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write file directly to uploads directory
    const uploadPath = path.join(uploadDir, uploadFileName);
    fs.writeFileSync(uploadPath, fileContent);
    console.log(`  File uploaded: ${uploadFileName}`);

    // Use the folder name as procedure type, default to 'General Diagnostic' if not found
    const procedureType = jobType || 'General Diagnostic';

    // Create the job via the API with the uploaded file
    const response = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: jobName,
        procedureType: procedureType, // Use the folder name as procedure type
        description: `Imported from ${fileName}`,
        vehicleModelYearId: modelYearId, // Use the correct vehicle
        vin: null,
        traceFiles: [{
          name: fileName,
          content: fileContent,
          path: uploadPath,  // Use the full upload path
          fileName: uploadFileName  // Use the uploaded filename
        }]
      })
    });

    if (response.ok) {
      const job = await response.json();
      console.log(`  ✓ Job created: ${job.id}`);
      return true;
    } else {
      const error = await response.text();
      console.error(`  ✗ Failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   Dynamic Trace File Import Script');
  console.log('===========================================');
  console.log(`Source: ${EXAMPLES_DIR}`);
  console.log(`API: ${API_BASE_URL}`);

  try {
    const traceFiles = await getAllTraceFiles(EXAMPLES_DIR);
    console.log(`\nFound ${traceFiles.length} trace files`);

    // Analyze the structure first to show what will be imported
    console.log('\nAnalyzing vehicle structure...');
    const vehicleMap = new Map();

    for (const filePath of traceFiles) {
      const relativePath = path.relative(EXAMPLES_DIR, filePath);
      const pathParts = relativePath.split(path.sep);

      // Find TraceLogs directory
      let startIndex = -1;
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i].toLowerCase().includes('tracelogs')) {
          startIndex = i + 1;
          break;
        }
      }

      if (startIndex === -1 || startIndex >= pathParts.length - 1) {
        continue; // Skip files not in TraceLogs
      }

      const relevantParts = pathParts.slice(startIndex);

      if (relevantParts.length >= 2) {
        const oemDir = relevantParts[0];
        const model = relevantParts[1];
        let year = null;

        // Find year in path
        for (let i = 2; i < relevantParts.length; i++) {
          const potentialYear = parseInt(relevantParts[i]);
          if (!isNaN(potentialYear) && potentialYear >= 1990 && potentialYear <= 2050) {
            year = potentialYear;
            break;
          }
        }

        if (!year) year = new Date().getFullYear();

        const key = `${normalizeOemName(oemDir)}|${model}|${year}`;
        vehicleMap.set(key, (vehicleMap.get(key) || 0) + 1);
      }
    }

    console.log(`\nUnique vehicles to be created/updated:`);
    const sortedVehicles = Array.from(vehicleMap.entries()).sort();
    sortedVehicles.forEach(([key, count]) => {
      const [oem, model, year] = key.split('|');
      console.log(`  • ${oem} → ${model} → ${year} (${count} file${count > 1 ? 's' : ''})`);
    });
    console.log(`\nTotal: ${vehicleMap.size} unique vehicle combinations`);

    // Ask for confirmation
    console.log('\nStarting import in 3 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Process all files
    console.log(`\nProcessing ${traceFiles.length} files...`);

    let successful = 0;
    let failed = 0;
    for (let i = 0; i < traceFiles.length; i++) {
      const file = traceFiles[i];
      console.log(`\n[${i + 1}/${traceFiles.length}]`);

      const success = await processTraceFile(file);
      if (success) {
        successful++;
      } else {
        failed++;
      }

      // Small delay between files to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n========================================`);
    console.log(`Import complete!`);
    console.log(`Total files: ${traceFiles.length}`);
    console.log(`Successfully processed: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`========================================`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { processTraceFile, getAllTraceFiles };