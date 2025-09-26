const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function updateOBDIIDTCs() {
  console.log('Starting OBD-II DTC database update...\n');

  try {
    // Load the extracted DTCs from Launch Tech
    const launchTechDTCs = JSON.parse(fs.readFileSync('launchtech-dtcs.json', 'utf8'));
    console.log(`Loaded ${launchTechDTCs.length} DTCs from Launch Tech`);

    // Get existing DTCs from database
    const existingDTCs = await prisma.oBDIIDTCDefinition.findMany({
      select: { code: true, name: true }
    });
    console.log(`Found ${existingDTCs.length} existing DTCs in database`);

    // Create a map for quick lookup
    const existingMap = new Map();
    existingDTCs.forEach(dtc => {
      existingMap.set(dtc.code, dtc);
    });

    // Find new DTCs to add
    const newDTCs = [];
    const updatedDTCs = [];

    for (const dtc of launchTechDTCs) {
      if (!existingMap.has(dtc.code)) {
        // New DTC to add
        newDTCs.push(dtc);
      } else {
        // Check if description needs updating
        const existing = existingMap.get(dtc.code);
        if (existing.name !== dtc.name && dtc.name.length > existing.name.length) {
          // Launch Tech has a longer/better description
          updatedDTCs.push(dtc);
        }
      }
    }

    console.log(`\nFound ${newDTCs.length} new DTCs to add`);
    console.log(`Found ${updatedDTCs.length} DTCs with better descriptions`);

    // Show some examples of new codes
    if (newDTCs.length > 0) {
      console.log('\nExample new DTCs to add:');
      newDTCs.slice(0, 10).forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
    }

    // Ask for confirmation
    console.log(`\n=== Summary ===`);
    console.log(`Current database: ${existingDTCs.length} DTCs`);
    console.log(`New codes to add: ${newDTCs.length}`);
    console.log(`Codes to update: ${updatedDTCs.length}`);
    console.log(`Final total: ${existingDTCs.length + newDTCs.length} DTCs`);

    // Add new DTCs in batches
    if (newDTCs.length > 0) {
      console.log('\nAdding new DTCs to database...');

      const batchSize = 100;
      for (let i = 0; i < newDTCs.length; i += batchSize) {
        const batch = newDTCs.slice(i, i + batchSize);

        await prisma.oBDIIDTCDefinition.createMany({
          data: batch.map(dtc => ({
            code: dtc.code,
            name: dtc.name,
            description: dtc.description,
            system: dtc.system,
            isGeneric: dtc.isGeneric,
            category: dtc.category
          })),
          skipDuplicates: true
        });

        console.log(`  Added batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newDTCs.length/batchSize)} (${batch.length} codes)`);
      }
    }

    // Update existing DTCs with better descriptions
    if (updatedDTCs.length > 0) {
      console.log('\nUpdating DTCs with better descriptions...');

      for (const dtc of updatedDTCs.slice(0, 50)) { // Limit updates to first 50 to avoid too many operations
        await prisma.oBDIIDTCDefinition.update({
          where: { code: dtc.code },
          data: {
            name: dtc.name,
            description: dtc.description
          }
        });
      }

      console.log(`  Updated ${Math.min(50, updatedDTCs.length)} DTCs`);
    }

    // Verify final count
    const finalCount = await prisma.oBDIIDTCDefinition.count();
    console.log(`\n✅ Update complete! Total DTCs in database: ${finalCount}`);

    // Show summary by system
    const systemCounts = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['system'],
      _count: true
    });

    console.log('\nDTCs by system:');
    systemCounts.forEach(s => {
      console.log(`  ${s.system}: ${s._count}`);
    });

  } catch (error) {
    console.error('Error updating DTCs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  updateOBDIIDTCs();
}

module.exports = updateOBDIIDTCs;