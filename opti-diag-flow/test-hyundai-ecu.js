const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Get messages for ECU_07CC
  const messages = await prisma.uDSMessage.findMany({
    where: {
      jobId: 'cmfv0wn5r0007ucms0l4yjp09',
      ecuAddress: '07CC'
    },
    orderBy: { timestamp: 'asc' },
    take: 10
  });

  console.log('Messages for ECU_07CC:');
  messages.forEach(msg => {
    const service = msg.serviceCode || 'N/A';
    const direction = msg.direction || 'N/A';
    const data = msg.rawData ? msg.rawData.substring(0, 30) : 'N/A';
    console.log(`  Time: ${msg.timestamp} - Dir: ${direction}, Service: ${service}, Data: ${data}...`);
  });

  // Also check for messages on 07C4
  const testerMessages = await prisma.uDSMessage.findMany({
    where: {
      jobId: 'cmfv0wn5r0007ucms0l4yjp09',
      ecuAddress: '07C4'
    },
    orderBy: { timestamp: 'asc' },
    take: 10
  });

  console.log('\nMessages for ECU_07C4 (should be empty if fix worked):');
  testerMessages.forEach(msg => {
    const service = msg.serviceCode || 'N/A';
    const direction = msg.direction || 'N/A';
    const data = msg.rawData ? msg.rawData.substring(0, 30) : 'N/A';
    console.log(`  Time: ${msg.timestamp} - Dir: ${direction}, Service: ${service}, Data: ${data}...`);
  });

  // Count Routine Control messages
  const routineControl = await prisma.uDSMessage.findMany({
    where: {
      jobId: 'cmfv0wn5r0007ucms0l4yjp09',
      ecuAddress: '07CC',
      OR: [
        { serviceCode: '31' },
        { serviceCode: '71' }
      ]
    }
  });

  const requests = routineControl.filter(m => m.serviceCode === '31').length;
  const responses = routineControl.filter(m => m.serviceCode === '71').length;

  console.log(`\nRoutine Control for ECU_07CC:`);
  console.log(`  Requests (0x31): ${requests}`);
  console.log(`  Responses (0x71): ${responses}`);

  await prisma.$disconnect();
}

check().catch(console.error);