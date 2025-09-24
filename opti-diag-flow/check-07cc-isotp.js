const http = require('http');

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    console.log('Checking ECU_07CC messages for ISO-TP framing:');
    console.log('================================================\n');

    // Find messages for ECU 07CC
    const ecu07CCMessages = messages.filter(m =>
      m.targetAddr === '07CC' || m.sourceAddr === '07CC'
    );

    console.log(`Total messages for ECU_07CC: ${ecu07CCMessages.length}\n`);

    // Check which have ISO-TP framing
    const withISOTP = ecu07CCMessages.filter(m => {
      if (!m.data || !m.data.startsWith('0x')) return false;
      const firstByte = m.data.substring(2, 4);
      const byteVal = parseInt(firstByte, 16);
      return byteVal >= 1 && byteVal <= 7;
    });

    console.log(`Messages with ISO-TP framing: ${withISOTP.length}`);
    console.log(`Messages without ISO-TP framing: ${ecu07CCMessages.length - withISOTP.length}\n`);

    // Show some examples
    console.log('Examples with ISO-TP:');
    withISOTP.slice(0, 5).forEach(msg => {
      const firstByte = msg.data.substring(2, 4);
      const length = parseInt(firstByte, 16);
      const actualService = msg.data.substring(4, 6);
      console.log(`  ${msg.data.substring(0, 20)} -> ISO-TP len=${length}, actual service=0x${actualService}`);
    });

    console.log('\nExamples without ISO-TP:');
    const withoutISOTP = ecu07CCMessages.filter(m => {
      if (!m.data || !m.data.startsWith('0x')) return false;
      const firstByte = m.data.substring(2, 4);
      const byteVal = parseInt(firstByte, 16);
      return byteVal < 1 || byteVal > 7;
    });

    withoutISOTP.slice(0, 5).forEach(msg => {
      const service = msg.data.substring(2, 4);
      console.log(`  ${msg.data.substring(0, 20)} -> service=0x${service}`);
    });

    // Check if there are any 0x03 frames that should be 0x31
    console.log('\nLooking for potential 0x03 frames containing 0x31:');
    const potential31 = ecu07CCMessages.filter(m =>
      m.data && (m.data.startsWith('0x0331') || m.data.includes('0331'))
    );
    console.log(`Found ${potential31.length} messages with pattern "0331"`);

    if (potential31.length > 0) {
      console.log('Examples:');
      potential31.slice(0, 3).forEach(msg => {
        console.log(`  ${msg.data} (${msg.direction})`);
      });
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});