const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// These are the most commonly used/important OBD-II codes that should definitely exist
const importantCodes = {
  // P0xxx - Generic Powertrain
  'P0000': 'SAE Reserved - Use Not Allowed',
  'P0017': 'Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor B)',
  'P0018': 'Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor A)',
  'P0019': 'Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor B)',

  // Common misfire codes
  'P0316': 'Engine Misfire Detected on Startup (First 1000 Revolutions)',
  'P0317': 'Rough Road Hardware Not Present',

  // Camshaft position sensors
  'P0345': 'Camshaft Position Sensor A Circuit (Bank 2)',
  'P0346': 'Camshaft Position Sensor A Circuit Range/Performance (Bank 2)',
  'P0347': 'Camshaft Position Sensor A Circuit Low (Bank 2)',
  'P0348': 'Camshaft Position Sensor A Circuit High (Bank 2)',
  'P0349': 'Camshaft Position Sensor A Circuit Intermittent (Bank 2)',

  // Cylinder misfires for 7-12 cylinder engines
  'P0307': 'Cylinder 7 Misfire Detected',
  'P0308': 'Cylinder 8 Misfire Detected',
  'P0309': 'Cylinder 9 Misfire Detected',
  'P0310': 'Cylinder 10 Misfire Detected',
  'P0311': 'Cylinder 11 Misfire Detected',
  'P0312': 'Cylinder 12 Misfire Detected',
  'P0313': 'Misfire Detected with Low Fuel',
  'P0314': 'Single Cylinder Misfire (Cylinder not Specified)',
  'P0315': 'Crankshaft Position System Variation Not Learned',

  // Common B0xxx codes
  'B0000': 'SAE Reserved - Use Not Allowed',

  // Common C0xxx codes
  'C0000': 'SAE Reserved - Use Not Allowed',

  // Common U0xxx codes
  'U0000': 'SAE Reserved - Use Not Allowed',
  'U0001': 'High Speed CAN Communication Bus',
  'U0002': 'High Speed CAN Communication Bus Performance',
  'U0003': 'High Speed CAN Communication Bus (+) Open',
  'U0004': 'High Speed CAN Communication Bus (+) Low',
  'U0005': 'High Speed CAN Communication Bus (+) High',
  'U0006': 'High Speed CAN Communication Bus (-) Open',
  'U0007': 'High Speed CAN Communication Bus (-) Low',
  'U0008': 'High Speed CAN Communication Bus (-) High',
  'U0009': 'High Speed CAN Communication Bus (-) Shorted to Bus (+)',
};

async function findMissingImportantCodes() {
  console.log('Checking for missing important OBD-II codes...\n');

  try {
    // Check which codes exist
    const existingCodes = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        code: {
          in: Object.keys(importantCodes)
        }
      },
      select: { code: true }
    });

    const existingSet = new Set(existingCodes.map(c => c.code));
    const missingCodes = [];

    for (const [code, name] of Object.entries(importantCodes)) {
      if (!existingSet.has(code)) {
        missingCodes.push({ code, name });
      }
    }

    if (missingCodes.length === 0) {
      console.log('✅ All important codes are present!');
      return;
    }

    console.log(`Found ${missingCodes.length} missing important codes:\n`);

    // Group by prefix
    const byPrefix = { P: [], B: [], C: [], U: [] };
    missingCodes.forEach(({ code, name }) => {
      const prefix = code[0];
      if (byPrefix[prefix]) {
        byPrefix[prefix].push({ code, name });
      }
    });

    // Display missing codes by category
    for (const [prefix, codes] of Object.entries(byPrefix)) {
      if (codes.length > 0) {
        console.log(`\n${prefix}-codes (${codes.length} missing):`);
        codes.forEach(({ code, name }) => {
          console.log(`  ${code}: ${name}`);
        });
      }
    }

    // Prepare data for insertion
    const toInsert = missingCodes.map(({ code, name }) => {
      const prefix = code[0];
      let system = 'Powertrain';
      let category = null;

      if (prefix === 'P') {
        system = 'Powertrain';
        const codeNum = parseInt(code.substring(1));
        if (codeNum >= 300 && codeNum <= 399) {
          category = 'Ignition System or Misfire';
        } else if (codeNum >= 340 && codeNum <= 349) {
          category = 'Ignition System or Misfire';
        } else if (codeNum === 0) {
          category = 'Computer Output Circuit';
        } else if (codeNum <= 99) {
          category = 'Fuel and Air Metering';
        }
      } else if (prefix === 'B') {
        system = 'Body';
        category = 'Body Electrical';
      } else if (prefix === 'C') {
        system = 'Chassis';
        category = 'Chassis';
      } else if (prefix === 'U') {
        system = 'Network';
        category = 'CAN Communication';
      }

      const isGeneric = (prefix === 'P' && parseInt(code.substring(1)) < 1000) ||
                        (prefix === 'B' && code[1] === '0') ||
                        (prefix === 'C' && code[1] === '0') ||
                        (prefix === 'U' && (code[1] === '0' || code[1] === '3'));

      return {
        code,
        name,
        description: name,
        system,
        isGeneric,
        category
      };
    });

    console.log(`\nAdding ${toInsert.length} missing codes to database...`);

    const result = await prisma.oBDIIDTCDefinition.createMany({
      data: toInsert,
      skipDuplicates: true
    });

    console.log(`✅ Successfully added ${result.count} codes`);

    // Verify critical ranges
    console.log('\nVerifying critical code ranges:');

    const p0300s = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P0300',
          lte: 'P0315'
        }
      }
    });
    console.log(`  P0300-P0315 (Misfires): ${p0300s}/16 codes present`);

    const u0000s = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'U0000',
          lte: 'U0009'
        }
      }
    });
    console.log(`  U0000-U0009 (CAN Bus): ${u0000s}/10 codes present`);

    const totalCount = await prisma.oBDIIDTCDefinition.count();
    console.log(`\nTotal OBD-II DTCs in database: ${totalCount}`);

  } catch (error) {
    console.error('Error checking/adding codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  findMissingImportantCodes();
}

module.exports = findMissingImportantCodes;