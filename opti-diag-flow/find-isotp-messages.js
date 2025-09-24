const http = require('http');

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages || [];

    console.log('Finding messages that might have ISO-TP framing:');
    console.log('=================================================\n');

    // Find messages that start with ISO-TP single frame bytes (0x01-0x07)
    const isotpMessages = messages.filter(m => {
      if (!m.data || !m.data.startsWith('0x')) return false;
      const firstByte = m.data.substring(2, 4); // Get first byte after 0x
      const byteVal = parseInt(firstByte, 16);
      return byteVal >= 1 && byteVal <= 7;
    });

    console.log(`Found ${isotpMessages.length} messages with potential ISO-TP single frames:\n`);

    // Group by first byte pattern
    const patterns = {};
    isotpMessages.forEach(msg => {
      const pattern = msg.data.substring(0, 6); // Get "0x03" part
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });

    console.log('Message patterns:');
    Object.entries(patterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}xx: ${count} messages`);
    });

    // Show some examples
    console.log('\nExample messages with ISO-TP framing:');
    isotpMessages.slice(0, 10).forEach(msg => {
      const firstByte = msg.data.substring(2, 4);
      const length = parseInt(firstByte, 16);
      console.log(`  Data: ${msg.data.substring(0, 20)}... (ISO-TP length=${length})`);

      // Show what the actual service would be after removing ISO-TP
      if (msg.data.length >= 6) {
        const actualService = msg.data.substring(4, 6);
        console.log(`    -> Actual service after ISO-TP: 0x${actualService}`);
      }
    });
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});