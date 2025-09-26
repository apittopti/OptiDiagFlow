const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyDTCConsistency() {
  console.log('Verifying DTC consistency across systems...\n');

  try {
    // Check for P-codes (Powertrain) that mention Body components
    const powertrain = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'P' } },
          {
            OR: [
              { name: { contains: 'airbag', mode: 'insensitive' } },
              { name: { contains: 'seat belt', mode: 'insensitive' } },
              { name: { contains: 'door', mode: 'insensitive' } },
              { name: { contains: 'window', mode: 'insensitive' } },
              { name: { contains: 'horn', mode: 'insensitive' } },
              { name: { contains: 'wiper', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (powertrain.length > 0) {
      console.log(`⚠️  Found ${powertrain.length} P-codes with body-related descriptions:`);
      powertrain.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
    }

    // Check for B-codes (Body) that mention powertrain components
    const body = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'B' } },
          {
            OR: [
              { name: { contains: 'engine', mode: 'insensitive' } },
              { name: { contains: 'transmission', mode: 'insensitive' } },
              { name: { contains: 'fuel', mode: 'insensitive' } },
              { name: { contains: 'exhaust', mode: 'insensitive' } },
              { name: { contains: 'emission', mode: 'insensitive' } },
              { name: { contains: 'ignition', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (body.length > 0) {
      console.log(`\n⚠️  Found ${body.length} B-codes with powertrain-related descriptions:`);
      body.slice(0, 10).forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
      if (body.length > 10) {
        console.log(`  ... and ${body.length - 10} more`);
      }
    }

    // Check for C-codes (Chassis) that mention unrelated components
    const chassis = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'C' } },
          {
            OR: [
              { name: { contains: 'airbag', mode: 'insensitive' } },
              { name: { contains: 'engine', mode: 'insensitive' } },
              { name: { contains: 'fuel', mode: 'insensitive' } },
              { name: { contains: 'emission', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (chassis.length > 0) {
      console.log(`\n⚠️  Found ${chassis.length} C-codes with unrelated descriptions:`);
      chassis.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
    }

    // Check for U-codes (Network) that mention physical components
    const network = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'U' } },
          {
            OR: [
              { name: { contains: 'pressure', mode: 'insensitive' } },
              { name: { contains: 'temperature', mode: 'insensitive' } },
              { name: { contains: 'flow', mode: 'insensitive' } },
              { name: { contains: 'valve', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (network.length > 0) {
      console.log(`\n⚠️  Found ${network.length} U-codes with physical component descriptions:`);
      network.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
    }

    // Show summary of all codes by prefix
    console.log('\n📊 Summary by DTC prefix:');
    const prefixCounts = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['system'],
      _count: true
    });

    prefixCounts.forEach(stat => {
      console.log(`  ${stat.system}: ${stat._count} DTCs`);
    });

    console.log('\n✅ Consistency verification complete!');

  } catch (error) {
    console.error('Error verifying consistency:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  verifyDTCConsistency();
}

module.exports = verifyDTCConsistency;