const http = require('http');

// Test the ISO-TP parsing logic
function parseISOTP(data) {
  const hex = data.trim().replace(/^0x/i, '').toUpperCase()
  if (hex.length < 2) return { hasISOTP: false, cleanData: hex }

  const firstByte = parseInt(hex.substring(0, 2), 16)

  if (firstByte >= 0x01 && firstByte <= 0x07) {
    const length = firstByte
    const dataStart = 2
    const dataEnd = dataStart + (length * 2)
    const cleanData = hex.substring(dataStart, dataEnd)
    return { hasISOTP: true, cleanData, actualLength: length }
  } else if ((firstByte & 0xF0) === 0x10) {
    const lengthHigh = firstByte & 0x0F
    const lengthLow = parseInt(hex.substring(2, 4), 16)
    const totalLength = (lengthHigh << 8) | lengthLow
    return { hasISOTP: true, cleanData: hex.substring(4), actualLength: totalLength }
  } else if ((firstByte & 0xF0) === 0x20) {
    return { hasISOTP: true, cleanData: hex.substring(2), actualLength: undefined }
  } else if ((firstByte & 0xF0) === 0x30) {
    return { hasISOTP: true, cleanData: hex.substring(2), actualLength: undefined }
  }

  return { hasISOTP: false, cleanData: hex }
}

function decodeUDSMessage(data, protocol) {
  if (!data || data.trim().length < 2) {
    return { service: '', dataBytes: '' }
  }

  let cleanData = data.trim().replace(/^0x/i, '').toUpperCase()
  let actualLength = undefined

  if (protocol !== 'DoIP') {
    const isotpResult = parseISOTP(data)
    cleanData = isotpResult.cleanData
    actualLength = isotpResult.actualLength
  }

  if (!cleanData || cleanData.length < 2) {
    return { service: '', dataBytes: '' }
  }

  const serviceId = cleanData.substring(0, 2).toUpperCase()
  const dataBytes = cleanData.length > 2 ? cleanData.substring(2) : ''

  return { service: serviceId, dataBytes }
}

const serviceNames = {
  '10': 'Diagnostic Session Control',
  '11': 'ECU Reset',
  '14': 'Clear DTC',
  '19': 'Read DTC',
  '22': 'Read Data by ID',
  '27': 'Security Access',
  '2E': 'Write Data by ID',
  '2F': 'Input Output Control',
  '31': 'Routine Control',
  '3E': 'Tester Present',
  '50': 'Diagnostic Session Control',
  '51': 'ECU Reset',
  '54': 'Clear DTC',
  '59': 'Read DTC',
  '62': 'Read Data by ID',
  '67': 'Security Access',
  '6E': 'Write Data by ID',
  '6F': 'Input Output Control',
  '71': 'Routine Control',
  '7E': 'Tester Present',
  '7F': 'Negative Response'
}

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    // Filter for ECU_07CC messages
    const ecu07CCMessages = messages.filter(m =>
      (m.targetAddr === '07CC' || m.sourceAddr === '07CC') && m.data
    );

    console.log('Analyzing ECU_07CC messages for service codes:');
    console.log('=================================================\n');

    // Count service codes
    const serviceCounts = {};
    const examples = {};

    ecu07CCMessages.forEach(msg => {
      const decoded = decodeUDSMessage(msg.data, msg.protocol);
      const serviceCode = decoded.service;

      if (serviceCode) {
        serviceCounts[serviceCode] = (serviceCounts[serviceCode] || 0) + 1;

        // Store an example for each service
        if (!examples[serviceCode]) {
          examples[serviceCode] = {
            data: msg.data,
            direction: msg.direction,
            decoded: decoded,
            protocol: msg.protocol
          };
        }
      }
    });

    // Display results
    console.log('Service code distribution:');
    Object.entries(serviceCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([code, count]) => {
        const name = serviceNames[code] || 'Unknown Service';
        console.log(`  0x${code}: ${name} - ${count} messages`);
      });

    console.log('\nExamples of service extraction:');
    ['31', '71', '3E', '7F', '19', '27'].forEach(code => {
      if (examples[code]) {
        const ex = examples[code];
        console.log(`\n  Service 0x${code} (${serviceNames[code] || 'Unknown'}):`);
        console.log(`    Raw data: ${ex.data}`);
        console.log(`    Direction: ${ex.direction}`);
        console.log(`    Protocol: ${ex.protocol}`);
        console.log(`    Extracted service: 0x${ex.decoded.service}`);
        console.log(`    Data bytes: ${ex.decoded.dataBytes.substring(0, 20)}...`);
      }
    });

    // Check for any that would show wrong
    console.log('\nChecking for potential issues:');
    let issueCount = 0;
    ecu07CCMessages.slice(0, 50).forEach(msg => {
      const decoded = decodeUDSMessage(msg.data, msg.protocol);

      // Check if this is a message that should be Routine Control but shows differently
      if (msg.data.includes('31') && decoded.service !== '31' && decoded.service !== '71') {
        console.log(`  Potential issue: ${msg.data} -> Service ${decoded.service}`);
        issueCount++;
      }
    });

    if (issueCount === 0) {
      console.log('  No issues detected - service codes appear to be extracting correctly!');
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});