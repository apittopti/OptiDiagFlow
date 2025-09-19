const fs = require('fs');
const path = require('path');

// Read the trace file
const traceFilePath = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogs\\Landrover\\Defender\\2020\\Camera Calibration\\8873778.txt';
const traceContent = fs.readFileSync(traceFilePath, 'utf8');

// Test data for API call
const testData = {
  name: 'Land Rover Defender Camera Calibration Test',
  jobType: 'Dynamic ADAS calibration',
  vehicleModelYearId: 'test-id', // Will be replaced with real ID
  vin: 'TESTVIN123456789',
  traceFiles: [
    {
      name: '8873778.txt',
      content: traceContent
    }
  ]
};

async function testTraceProcessing() {
  try {
    console.log('Testing trace processing API...');
    console.log(`Trace file size: ${traceContent.length} characters`);

    // First get a valid model year ID
    console.log('Getting model years...');
    const modelYearsResponse = await fetch('http://localhost:6001/api/model-years');
    const modelYears = await modelYearsResponse.json();

    if (modelYears.length > 0) {
      testData.vehicleModelYearId = modelYears[0].id;
      console.log('Using model year:', modelYears[0].year, modelYears[0].Model?.name);
    }

    console.log('Creating diagnostic job...');
    const response = await fetch('http://localhost:6001/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('Success! Job created:', result.id);
      console.log('Job name:', result.name);
      console.log('Status:', result.status);

      // Wait a moment then check the job details
      console.log('\nWaiting 3 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const jobResponse = await fetch(`http://localhost:6001/api/jobs/${result.id}`);

      if (jobResponse.ok) {
        const jobDetails = await jobResponse.json();
        console.log('\nJob details after processing:');
        console.log('Message count:', jobDetails.messageCount);
        console.log('ECU count:', jobDetails._count.ECUConfiguration);
        console.log('DID count:', jobDetails._count.DataIdentifier);
        console.log('DTC count:', jobDetails._count.DTC);
        console.log('Routine count:', jobDetails._count.Routine);
        console.log('Metadata:', JSON.stringify(jobDetails.metadata, null, 2));
      } else {
        console.log('Failed to fetch job details:', await jobResponse.text());
      }

    } else {
      console.log('Failed to create job');
      console.log('Response:', responseText);
    }
  } catch (error) {
    console.error('Error testing trace processing:', error);
  }
}

testTraceProcessing();