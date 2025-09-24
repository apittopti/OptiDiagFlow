const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // Check messages for ECU_07CC
    const ecuMessages = await prisma.uDSMessage.findMany({
      where: {
        jobId: 'cmfv0wn5r0007ucms0l4yjp09',
        ecuAddress: '07CC'
      },
      select: {
        timestamp: true,
        direction: true,
        serviceCode: true,
        rawData: true
      },
      orderBy: { timestamp: 'asc' }
    });

    // Count Routine Control messages
    const routineRequests = ecuMessages.filter(m => m.serviceCode === '31').length;
    const routineResponses = ecuMessages.filter(m => m.serviceCode === '71').length;

    console.log('=== ECU_07CC Analysis ===');
    console.log(`Total messages: ${ecuMessages.length}`);
    console.log(`Routine Control Requests (0x31): ${routineRequests}`);
    console.log(`Routine Control Responses (0x71): ${routineResponses}`);

    if (routineRequests > 0) {
      console.log('\n✅ SUCCESS: Routine Control requests are now properly associated with ECU_07CC');
      console.log('\nSample Routine Control messages:');
      ecuMessages
        .filter(m => m.serviceCode === '31' || m.serviceCode === '71')
        .slice(0, 4)
        .forEach(msg => {
          const type = msg.serviceCode === '31' ? 'REQUEST' : 'RESPONSE';
          console.log(`  ${msg.timestamp} - ${type} - Data: ${msg.rawData.substring(0, 20)}`);
        });
    } else {
      console.log('\n❌ ISSUE: No Routine Control requests found for ECU_07CC');
    }

    // Check if any messages exist on 07C4 (should be none after fix)
    const testerMessages = await prisma.uDSMessage.count({
      where: {
        jobId: 'cmfv0wn5r0007ucms0l4yjp09',
        ecuAddress: '07C4'
      }
    });

    console.log(`\nMessages on ECU_07C4: ${testerMessages} (should be 0 after fix)`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();