const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkP2Codes() {
  console.log('Checking P2xxx generic OBD-II codes...\n');

  try {
    // Check P2000-P2999 range (generic codes are P2000-P2999)
    const p2Count = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P2000',
          lte: 'P2999'
        }
      }
    });

    console.log(`P2000-P2999 codes in database: ${p2Count}`);

    // Get some examples
    const p2Examples = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        code: {
          gte: 'P2000',
          lte: 'P2999'
        }
      },
      select: { code: true, name: true, isGeneric: true },
      orderBy: { code: 'asc' },
      take: 10
    });

    if (p2Examples.length > 0) {
      console.log('\nFirst 10 P2xxx codes:');
      p2Examples.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name} (${dtc.isGeneric ? 'Generic' : 'Manufacturer'})`);
      });
    } else {
      console.log('\n⚠️  No P2xxx codes found! These are important generic OBD-II codes.');

      // Add some critical P2xxx codes
      const criticalP2Codes = [
        { code: 'P2000', name: 'NOx Trap Efficiency Below Threshold Bank 1', description: 'NOx Trap Efficiency Below Threshold Bank 1' },
        { code: 'P2001', name: 'NOx Trap Efficiency Below Threshold Bank 2', description: 'NOx Trap Efficiency Below Threshold Bank 2' },
        { code: 'P2002', name: 'Particulate Trap Efficiency Below Threshold Bank 1', description: 'Particulate Trap Efficiency Below Threshold Bank 1' },
        { code: 'P2003', name: 'Particulate Trap Efficiency Below Threshold Bank 2', description: 'Particulate Trap Efficiency Below Threshold Bank 2' },
        { code: 'P2004', name: 'Particulate Trap Bank 1 Intake Manifold Runner Control Stuck Open', description: 'Particulate Trap Bank 1 Intake Manifold Runner Control Stuck Open' },
        { code: 'P2005', name: 'Particulate Trap Bank 2 Intake Manifold Runner Control Stuck Open', description: 'Particulate Trap Bank 2 Intake Manifold Runner Control Stuck Open' },
        { code: 'P2006', name: 'Particulate Trap Bank 1 Intake Manifold Runner Control Stuck Closed', description: 'Particulate Trap Bank 1 Intake Manifold Runner Control Stuck Closed' },
        { code: 'P2007', name: 'Particulate Trap Bank 2 Intake Manifold Runner Control Stuck Closed', description: 'Particulate Trap Bank 2 Intake Manifold Runner Control Stuck Closed' },
        { code: 'P2008', name: 'Particulate Trap Bank 1 Intake Manifold Runner Control Circuit/Open', description: 'Particulate Trap Bank 1 Intake Manifold Runner Control Circuit/Open' },
        { code: 'P2009', name: 'Particulate Trap Bank 1 Intake Manifold Runner Control Circuit Low', description: 'Particulate Trap Bank 1 Intake Manifold Runner Control Circuit Low' }
      ];

      console.log(`\nAdding ${criticalP2Codes.length} critical P2xxx codes...`);

      const toInsert = criticalP2Codes.map(c => ({
        ...c,
        system: 'Powertrain',
        isGeneric: true,
        category: 'Auxiliary Emission Controls'
      }));

      const result = await prisma.oBDIIDTCDefinition.createMany({
        data: toInsert,
        skipDuplicates: true
      });

      console.log(`✅ Added ${result.count} P2xxx codes`);
    }

    // Check for U3xxx codes (also generic)
    const u3Count = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'U3000',
          lte: 'U3999'
        }
      }
    });

    console.log(`\nU3000-U3999 codes in database: ${u3Count}`);

    // Summary
    const totalGeneric = await prisma.oBDIIDTCDefinition.count({
      where: { isGeneric: true }
    });

    const totalManufacturer = await prisma.oBDIIDTCDefinition.count({
      where: { isGeneric: false }
    });

    console.log('\nSummary:');
    console.log(`  Generic codes: ${totalGeneric}`);
    console.log(`  Manufacturer codes: ${totalManufacturer}`);
    console.log(`  Total codes: ${totalGeneric + totalManufacturer}`);

  } catch (error) {
    console.error('Error checking P2 codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkP2Codes();
}

module.exports = checkP2Codes;