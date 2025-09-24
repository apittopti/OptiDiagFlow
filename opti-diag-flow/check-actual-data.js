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
  }

  return { hasISOTP: false, cleanData: hex }
}

function decodeUDSMessage(data) {
  if (!data || data.trim().length < 2) {
    return { service: '', dataBytes: '' }
  }

  let cleanData = data.trim().replace(/^0x/i, '').toUpperCase()

  // Check for ISO-TP framing
  const isotpResult = parseISOTP(data)
  cleanData = isotpResult.cleanData

  if (!cleanData || cleanData.length < 2) {
    return { service: '', dataBytes: '' }
  }

  const serviceId = cleanData.substring(0, 2).toUpperCase()
  const dataBytes = cleanData.length > 2 ? cleanData.substring(2) : ''

  return { service: serviceId, dataBytes }
}

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    console.log('Checking actual data in messages:');
    console.log('===================================\n');

    // Find messages that show as "03" in the UI but should be "31"
    const problematicMessages = messages.filter(m =>
      m.data && (
        m.data.includes('03310') || // ISO-TP frame with 31 service
        m.data.includes('0331')  || // ISO-TP frame with 31 service
        m.data === '0x033101AA' ||
        m.data === '0x03310301' ||
        m.data === '0x033103F003'
      )
    );

    console.log(`Found ${problematicMessages.length} potentially problematic messages:\n`);

    problematicMessages.slice(0, 10).forEach(msg => {
      console.log(`Raw data: ${msg.data}`);
      console.log(`Direction: ${msg.direction}`);
      console.log(`Source: ${msg.sourceAddr} -> Target: ${msg.targetAddr}`);

      const decoded = decodeUDSMessage(msg.data);
      console.log(`Decoded service: ${decoded.service} (should be 31 for Routine Control)`);
      console.log(`---`);
    });

    // Also check some normal messages
    console.log('\nChecking normal messages (should work correctly):');
    const normalMessages = messages.filter(m =>
      m.data && (
        m.data === '0x3103F00301' ||
        m.data === '0x190208' ||
        m.data === '0x2712D49A7B24186245C9'
      )
    );

    normalMessages.slice(0, 5).forEach(msg => {
      const decoded = decodeUDSMessage(msg.data);
      console.log(`Data: ${msg.data} -> Service: ${decoded.service}`);
    });
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});