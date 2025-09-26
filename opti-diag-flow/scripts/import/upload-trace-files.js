const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = 'http://localhost:6001';
const TRACE_LOGS_DIR = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete';

// This script uploads all trace files from TraceLogsComplete to the uploads/traces directory
// Usage: node upload-trace-files.js

// Vehicle model year mappings based on directory structure
const VEHICLE_MAPPINGS = {
  'Fiat': { oem: 'Fiat', model: '500e', year: 2021 },
  'Ford': { oem: 'Ford', model: 'Various', year: 2023 },
  'Honda': { oem: 'Honda', model: 'Jazz', year: 2020 },
  'Hyundai': { oem: 'Hyundai', model: 'i20', year: 2021 },
  'Kia': { oem: 'Kia', model: 'Various', year: 2022 },
  'Landrover': { oem: 'Land Rover', model: 'Various', year: 2023 },
  'Mercedes': { oem: 'Mercedes-Benz', model: 'Various', year: 2023 },
  'MG': { oem: 'MG', model: 'MG 3', year: 2021 },
  'Mitsubishi': { oem: 'Mitsubishi', model: 'Various', year: 2023 },
  'Nissan': { oem: 'Nissan', model: 'Qashqai', year: 2022 },
  'Polestar': { oem: 'Polestar', model: 'Polestar 2', year: 2022 },
  'Toyota': { oem: 'Toyota', model: 'Yaris', year: 2024 },
  'Vauxhall': { oem: 'Vauxhall', model: 'Various', year: 2023 },
  'Volkswagen': { oem: 'Volkswagen', model: 'Various', year: 2023 },
  'Volvo': { oem: 'Volvo', model: 'Various', year: 2023 }
};

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

async function getOrCreateVehicle(oemName, modelName, year) {
  try {
    // First, get the vehicle hierarchy
    const hierarchyResponse = await fetch(`${API_BASE_URL}/api/vehicles/hierarchy`);
    const hierarchy = await hierarchyResponse.json();

    // Find or create OEM - check both name and Model array
    let oem = hierarchy.find(o => o.name === oemName || o.shortName === oemName.toUpperCase());
    if (!oem) {
      // Check if OEM exists with Model property instead of models
      oem = hierarchy.find(o => o.Model && (o.name === oemName || o.shortName === oemName.toUpperCase()));
    }

    if (!oem) {
      console.log(`Creating OEM: ${oemName}`);
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

    // Find or create Model - note the capital M in Model
    const models = oem.Model || oem.models || [];
    let model = models.find(m => m.name === modelName);

    if (!model) {
      console.log(`Creating Model: ${modelName} for ${oemName}`);
      // Generate a unique code from the name
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

    // Find or create ModelYear - note the capital M in ModelYear
    const modelYears = model.ModelYear || model.modelYears || [];
    let modelYear = modelYears.find(my => my.year === year);

    if (!modelYear) {
      console.log(`Creating ModelYear: ${year} for ${modelName}`);
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

async function uploadTraceFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    // Extract OEM from directory structure
    const pathParts = dirPath.split(path.sep);
    const traceLogsIndex = pathParts.indexOf('TraceLogsComplete');
    const oemDir = pathParts[traceLogsIndex + 1] || 'Unknown';

    // Get vehicle info
    const vehicleInfo = VEHICLE_MAPPINGS[oemDir] || { oem: oemDir, model: 'Unknown', year: 2023 };
    const oemName = vehicleInfo.oem;

    // Get or create vehicle
    const modelYearId = await getOrCreateVehicle(oemName, vehicleInfo.model, vehicleInfo.year);
    if (!modelYearId) {
      console.error(`Failed to get/create vehicle for ${fileName}`);
      return;
    }

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Extract job name from filename (remove timestamp prefix if present)
    let jobName = fileName.replace('.txt', '');
    // If filename has timestamp prefix like "1758782561675-6xc4h-", remove it
    if (jobName.match(/^\d{13}-[a-z0-9]+-/)) {
      jobName = jobName.replace(/^\d{13}-[a-z0-9]+-/, '');
    }

    console.log(`\nUploading: ${fileName}`);
    console.log(`  OEM: ${oemName}, Model: ${vehicleInfo.model}, Year: ${vehicleInfo.year}`);
    console.log(`  Job Name: ${jobName}`);

    // First upload the file
    const formData = new FormData();
    const buffer = Buffer.from(fileContent, 'utf8');
    formData.append('file', buffer, {
      filename: fileName,
      contentType: 'text/plain'
    });

    const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!uploadResponse.ok) {
      console.error(`Failed to upload ${fileName}:`, await uploadResponse.text());
      return;
    }

    const uploadData = await uploadResponse.json();
    console.log(`  File uploaded: ${uploadData.fileName}`);

    // Create job with the uploaded file
    const jobData = {
      name: jobName,
      jobType: 'Diagnostic Session',
      description: `Imported from ${filePath}`,
      vehicleModelYearId: modelYearId,
      vin: null,
      traceFiles: [{
        name: fileName,
        content: fileContent,
        path: filePath,  // Store the original full path
        fileName: uploadData.fileName  // Store the uploaded filename
      }]
    };

    const jobResponse = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });

    if (!jobResponse.ok) {
      console.error(`Failed to create job for ${fileName}:`, await jobResponse.text());
      return;
    }

    const job = await jobResponse.json();
    console.log(`  ✓ Job created: ${job.id}`);

    return job;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

async function main() {
  console.log('Starting trace file upload process...');
  console.log(`Source directory: ${TRACE_LOGS_DIR}`);
  console.log(`API endpoint: ${API_BASE_URL}`);

  try {
    // Get all trace files
    const traceFiles = await getAllTraceFiles(TRACE_LOGS_DIR);
    console.log(`\nFound ${traceFiles.length} trace files to process`);

    // Process files in batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    let processed = 0;
    let successful = 0;

    for (let i = 0; i < traceFiles.length; i += BATCH_SIZE) {
      const batch = traceFiles.slice(i, Math.min(i + BATCH_SIZE, traceFiles.length));
      console.log(`\n--- Processing batch ${Math.floor(i/BATCH_SIZE) + 1} (files ${i+1}-${Math.min(i+BATCH_SIZE, traceFiles.length)}) ---`);

      const promises = batch.map(file => uploadTraceFile(file));
      const results = await Promise.allSettled(promises);

      results.forEach(result => {
        processed++;
        if (result.status === 'fulfilled' && result.value) {
          successful++;
        }
      });

      // Small delay between batches
      if (i + BATCH_SIZE < traceFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n========================================`);
    console.log(`Upload process complete!`);
    console.log(`Total files processed: ${processed}`);
    console.log(`Successfully uploaded: ${successful}`);
    console.log(`Failed: ${processed - successful}`);
    console.log(`========================================`);

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Check if form-data is installed
try {
  require.resolve('form-data');
  // Run the main function
  if (require.main === module) {
    main();
  }
} catch(e) {
  console.error('form-data package is not installed.');
  console.log('Please run: npm install form-data');
  process.exit(1);
}

module.exports = { uploadTraceFile, getAllTraceFiles };