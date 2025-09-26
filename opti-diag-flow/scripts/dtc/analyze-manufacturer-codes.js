const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeManufacturerCodes() {
  console.log('Analyzing Manufacturer-Specific vs Generic OBD-II Codes\n');
  console.log('='.repeat(60));

  try {
    // Get examples of manufacturer-specific P-codes (P1xxx, P3xxx)
    const manufacturerPCodes = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'P' } },
          { isGeneric: false }
        ]
      },
      orderBy: { code: 'asc' },
      take: 10
    });

    console.log('\n📌 MANUFACTURER-SPECIFIC CODES:');
    console.log('These codes (P1xxx, P3xxx, B1xxx, C1xxx, U1xxx) can have DIFFERENT meanings');
    console.log('for different manufacturers!\n');

    console.log('Examples of Manufacturer-Specific P-codes:');
    manufacturerPCodes.forEach(dtc => {
      console.log(`  ${dtc.code}: ${dtc.name}`);
    });

    // Show how the same code could mean different things
    console.log('\n⚠️  IMPORTANT: The SAME manufacturer code can mean DIFFERENT things:');
    console.log('\nExample - P1000 means:');
    console.log('  • Ford/Mazda: "OBD Systems Readiness Test Not Complete"');
    console.log('  • Jaguar: "System Readiness Test Not Complete"');
    console.log('  • BMW: "Valvetronic System Fault"');
    console.log('  • Nissan: "Light Detection System Malfunction"');

    console.log('\nExample - P1100 means:');
    console.log('  • Hyundai: "Map Sensor - Malfunction"');
    console.log('  • Volkswagen: "O2 Sensor Heating Circuit Bank 1 Sensor 2"');
    console.log('  • Nissan: "MAF Sensor Intermittent"');
    console.log('  • Infiniti: "MAF Sensor Intermittent"');

    // Get examples of generic codes
    const genericPCodes = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'P0' } },
          { isGeneric: true }
        ]
      },
      orderBy: { code: 'asc' },
      take: 10
    });

    console.log('\n✅ GENERIC CODES:');
    console.log('These codes (P0xxx, P2xxx, B0xxx, C0xxx, U0xxx) have the SAME meaning');
    console.log('across ALL manufacturers (ISO/SAE standard):\n');

    console.log('Examples of Generic P-codes:');
    genericPCodes.forEach(dtc => {
      console.log(`  ${dtc.code}: ${dtc.name}`);
    });

    console.log('\n📊 CODE RANGES BREAKDOWN:');
    console.log('\nPOWERTRAIN (P-codes):');
    console.log('  P0000-P0999: GENERIC (same for all manufacturers)');
    console.log('  P1000-P1999: MANUFACTURER-SPECIFIC');
    console.log('  P2000-P2999: GENERIC (same for all manufacturers)');
    console.log('  P3000-P3999: MANUFACTURER-SPECIFIC');

    console.log('\nBODY (B-codes):');
    console.log('  B0000-B0999: GENERIC (same for all manufacturers)');
    console.log('  B1000-B3999: MANUFACTURER-SPECIFIC');

    console.log('\nCHASSIS (C-codes):');
    console.log('  C0000-C0999: GENERIC (same for all manufacturers)');
    console.log('  C1000-C3999: MANUFACTURER-SPECIFIC');

    console.log('\nNETWORK (U-codes):');
    console.log('  U0000-U0999: GENERIC (same for all manufacturers)');
    console.log('  U1000-U2999: MANUFACTURER-SPECIFIC');
    console.log('  U3000-U3999: GENERIC (same for all manufacturers)');

    // Count by category
    const stats = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN code LIKE 'P%' THEN 'P-Powertrain'
          WHEN code LIKE 'B%' THEN 'B-Body'
          WHEN code LIKE 'C%' THEN 'C-Chassis'
          WHEN code LIKE 'U%' THEN 'U-Network'
        END as prefix,
        "isGeneric",
        COUNT(*) as count
      FROM "OBDIIDTCDefinition"
      GROUP BY prefix, "isGeneric"
      ORDER BY prefix, "isGeneric"
    `;

    console.log('\n📈 CURRENT DATABASE STATISTICS:');
    stats.forEach(stat => {
      const type = stat.isGeneric ? 'Generic' : 'Manufacturer';
      console.log(`  ${stat.prefix} ${type}: ${stat.count} codes`);
    });

    // Look for potential conflicts
    console.log('\n⚠️  DATABASE LIMITATION:');
    console.log('Our current database stores manufacturer-specific codes with generic');
    console.log('descriptions that may NOT be accurate for all manufacturers.');
    console.log('\nFor accurate manufacturer-specific code definitions, you would need:');
    console.log('  • Separate tables for each manufacturer');
    console.log('  • Or a manufacturer field to differentiate meanings');
    console.log('  • Access to each manufacturer\'s proprietary DTC database');

    console.log('\n💡 RECOMMENDATION:');
    console.log('When diagnosing a vehicle:');
    console.log('  1. Generic codes (P0xxx, P2xxx, etc.) - Use our database confidently');
    console.log('  2. Manufacturer codes (P1xxx, P3xxx, etc.) - Cross-reference with');
    console.log('     manufacturer-specific documentation for that vehicle make/model');

  } catch (error) {
    console.error('Error analyzing codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  analyzeManufacturerCodes();
}

module.exports = analyzeManufacturerCodes;