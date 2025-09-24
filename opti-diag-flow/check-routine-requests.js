const http = require('http');

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    console.log('Looking for Routine Control (0x31) requests:');
    console.log('=============================================\n');

    // Find all messages with 31 in the data
    const with31 = messages.filter(m =>
      m.data && m.data.includes('31')
    );

    console.log(`Total messages containing "31": ${with31.length}\n`);

    // Find actual 0x31 service messages
    const routine31 = messages.filter(m => {
      if (!m.data) return false;
      // Check if raw data starts with 0x31
      return m.data.startsWith('0x31');
    });

    console.log(`Messages starting with 0x31: ${routine31.length}`);
    if (routine31.length > 0) {
      console.log('Examples:');
      routine31.slice(0, 3).forEach(msg => {
        console.log(`  ${msg.data} (${msg.direction}, ${msg.sourceAddr}->${msg.targetAddr})`);
      });
    }

    // Look for ISO-TP frames containing 31
    const isotp31 = messages.filter(m => {
      if (!m.data) return false;
      // Check for ISO-TP single frame with 31 as service
      return m.data.match(/^0x0[1-7]31/);
    });

    console.log(`\nISO-TP frames with 0x31 service: ${isotp31.length}`);
    if (isotp31.length > 0) {
      console.log('Examples:');
      isotp31.slice(0, 3).forEach(msg => {
        console.log(`  ${msg.data} (${msg.direction}, ${msg.sourceAddr}->${msg.targetAddr})`);
      });
    }

    // Check for messages marked as service code 31
    const service31 = messages.filter(m => m.serviceCode === '31');
    console.log(`\nMessages with serviceCode='31': ${service31.length}`);

    // Check ECU_07CC specifically
    const ecu07CC31 = messages.filter(m =>
      (m.targetAddr === '07CC' || m.sourceAddr === '07CC') &&
      m.data && m.data.includes('31') && m.direction === 'Local->Remote'
    );

    console.log(`\nECU_07CC messages with '31' in request direction: ${ecu07CC31.length}`);
    if (ecu07CC31.length > 0) {
      console.log('Examples:');
      ecu07CC31.slice(0, 5).forEach(msg => {
        console.log(`  ${msg.data} (from ${msg.sourceAddr} to ${msg.targetAddr})`);
      });
    }

    // Check if we have matching request/response pairs
    const responses71 = messages.filter(m =>
      (m.targetAddr === '07CC' || m.sourceAddr === '07CC') &&
      m.data && m.data.startsWith('0x71')
    );

    console.log(`\nECU_07CC Routine Control responses (0x71): ${responses71.length}`);
    console.log(`ECU_07CC Routine Control requests (0x31): ${routine31.filter(m => m.targetAddr === '07CC' || m.sourceAddr === '07CC').length}`);

    if (responses71.length > 0 && routine31.filter(m => m.targetAddr === '07CC' || m.sourceAddr === '07CC').length === 0) {
      console.log('\n⚠️  ISSUE: Found Routine Control responses but no requests!');
      console.log('This suggests the requests are still not being associated with the correct ECU.');
    } else if (responses71.length > 0) {
      console.log('\n✓ Good: Found both requests and responses for Routine Control');
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});