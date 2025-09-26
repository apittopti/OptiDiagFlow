const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Standard P0001-P0009 OBD-II codes that are missing
const missingPCodes = [
  {
    code: 'P0001',
    name: 'Fuel Volume Regulator Control Circuit/Open',
    description: 'Fuel Volume Regulator Control Circuit/Open',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0002',
    name: 'Fuel Volume Regulator Control Circuit Range/Performance',
    description: 'Fuel Volume Regulator Control Circuit Range/Performance',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0003',
    name: 'Fuel Volume Regulator Control Circuit Low',
    description: 'Fuel Volume Regulator Control Circuit Low',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0004',
    name: 'Fuel Volume Regulator Control Circuit High',
    description: 'Fuel Volume Regulator Control Circuit High',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0005',
    name: 'Fuel Shutoff Valve A Control Circuit/Open',
    description: 'Fuel Shutoff Valve A Control Circuit/Open',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0006',
    name: 'Fuel Shutoff Valve A Control Circuit Low',
    description: 'Fuel Shutoff Valve A Control Circuit Low',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0007',
    name: 'Fuel Shutoff Valve A Control Circuit High',
    description: 'Fuel Shutoff Valve A Control Circuit High',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0008',
    name: 'Engine Position System Performance Bank 1',
    description: 'Engine Position System Performance Bank 1',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  },
  {
    code: 'P0009',
    name: 'Engine Position System Performance Bank 2',
    description: 'Engine Position System Performance Bank 2',
    system: 'Powertrain',
    isGeneric: true,
    category: 'Fuel and Air Metering'
  }
];

async function addMissingPCodes() {
  console.log('Adding missing P0001-P0009 codes...\n');

  try {
    // Check which codes already exist
    const existingCodes = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        code: {
          in: missingPCodes.map(c => c.code)
        }
      },
      select: { code: true }
    });

    const existingCodeSet = new Set(existingCodes.map(c => c.code));
    const codesToAdd = missingPCodes.filter(c => !existingCodeSet.has(c.code));

    if (codesToAdd.length === 0) {
      console.log('All P0001-P0009 codes already exist in the database.');
      return;
    }

    console.log(`Adding ${codesToAdd.length} missing codes:`);
    codesToAdd.forEach(c => {
      console.log(`  ${c.code}: ${c.name}`);
    });

    // Add the missing codes
    const result = await prisma.oBDIIDTCDefinition.createMany({
      data: codesToAdd
    });

    console.log(`\n✅ Successfully added ${result.count} DTCs`);

    // Verify they were added
    const verifyCount = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          startsWith: 'P000'
        }
      }
    });

    console.log(`\nTotal P000x codes in database: ${verifyCount}`);

    // Show all P000x codes
    const allP000x = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        code: {
          startsWith: 'P000'
        }
      },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    });

    console.log('\nAll P000x codes now in database:');
    allP000x.forEach(dtc => {
      console.log(`  ${dtc.code}: ${dtc.name}`);
    });

  } catch (error) {
    console.error('Error adding P-codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  addMissingPCodes();
}

module.exports = addMissingPCodes;