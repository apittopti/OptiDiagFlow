const http = require('http');

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    // Find messages with specific data patterns
    console.log('Checking message data format:');
    console.log('==============================\n');

    // Check messages that should be Routine Control (0x31)
    const msg1 = messages.find(m => m.data && m.data.includes('3103F003'));
    if (msg1) {
      console.log('Message that should be Routine Control (0x31):');
      console.log('  Raw data:', msg1.data);
      console.log('  Direction:', msg1.direction);
      console.log('  Expected service: 0x31');
      console.log('  Data starts with "0x"?', msg1.data.startsWith('0x'));
      console.log('');
    }

    // Check messages that should be Read DTC (0x19)
    const msg2 = messages.find(m => m.data && m.data.includes('190208'));
    if (msg2) {
      console.log('Message that should be Read DTC (0x19):');
      console.log('  Raw data:', msg2.data);
      console.log('  Direction:', msg2.direction);
      console.log('  Expected service: 0x19');
      console.log('  Data starts with "0x"?', msg2.data.startsWith('0x'));
      console.log('');
    }

    // Check messages that should be Security Access (0x27)
    const msg3 = messages.find(m => m.data && m.data.includes('2712'));
    if (msg3) {
      console.log('Message that should be Security Access (0x27):');
      console.log('  Raw data:', msg3.data);
      console.log('  Direction:', msg3.direction);
      console.log('  Expected service: 0x27');
      console.log('  Data starts with "0x"?', msg3.data.startsWith('0x'));
      console.log('');
    }

    // Show first few messages raw format
    console.log('First 5 messages with data:');
    messages.filter(m => m.data).slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i+1}. Data: ${msg.data.substring(0, 30)}...`);
    });
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});