const http = require('http');

http.get('http://localhost:6001/api/jobs/cmfv0wn5r0007ucms0l4yjp09', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    const job = JSON.parse(data);
    const messages = job.metadata.messages;

    // Find Routine Control messages
    const routineControlMessages = messages.filter(m =>
      m.data && (m.data.startsWith('0x31') || m.data.startsWith('0x71'))
    );

    console.log(`Found ${routineControlMessages.length} Routine Control messages:\n`);

    routineControlMessages.slice(0, 5).forEach(msg => {
      console.log(`Time: ${msg.timestamp}`);
      console.log(`Direction: ${msg.direction}`);
      console.log(`Source: ${msg.sourceAddr} -> Target: ${msg.targetAddr}`);
      console.log(`Data: ${msg.data}`);
      console.log(`Protocol: ${msg.protocol}`);
      console.log('---');
    });
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});