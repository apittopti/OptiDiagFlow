const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('===========================================');
  console.log('   Cleaning All Data');
  console.log('===========================================');

  try {
    // Delete all jobs and related data
    console.log('\nDeleting all diagnostic jobs...');
    const jobCount = await prisma.diagnosticJob.count();
    await prisma.diagnosticJob.deleteMany({});
    console.log(`  ✓ Deleted ${jobCount} jobs`);

    // Delete all ECU configurations
    console.log('Deleting ECU configurations...');
    const ecuCount = await prisma.eCUConfiguration.count();
    await prisma.eCUConfiguration.deleteMany({});
    console.log(`  ✓ Deleted ${ecuCount} ECU configurations`);

    // Delete all DTCs
    console.log('Deleting DTCs...');
    const dtcCount = await prisma.dTC.count();
    await prisma.dTC.deleteMany({});
    console.log(`  ✓ Deleted ${dtcCount} DTCs`);

    // Delete all DataIdentifiers
    console.log('Deleting DataIdentifiers...');
    const didCount = await prisma.dataIdentifier.count();
    await prisma.dataIdentifier.deleteMany({});
    console.log(`  ✓ Deleted ${didCount} DIDs`);

    // Delete all Routines
    console.log('Deleting Routines...');
    const routineCount = await prisma.routine.count();
    await prisma.routine.deleteMany({});
    console.log(`  ✓ Deleted ${routineCount} routines`);

    // Delete all Vehicles
    console.log('Deleting Vehicles...');
    const vehicleCount = await prisma.vehicle.count();
    await prisma.vehicle.deleteMany({});
    console.log(`  ✓ Deleted ${vehicleCount} vehicles`);

    // Delete all ModelYears
    console.log('Deleting ModelYears...');
    const modelYearCount = await prisma.modelYear.count();
    await prisma.modelYear.deleteMany({});
    console.log(`  ✓ Deleted ${modelYearCount} model years`);

    // Delete all Models
    console.log('Deleting Models...');
    const modelCount = await prisma.model.count();
    await prisma.model.deleteMany({});
    console.log(`  ✓ Deleted ${modelCount} models`);

    // Delete all OEMs
    console.log('Deleting OEMs...');
    const oemCount = await prisma.oEM.count();
    await prisma.oEM.deleteMany({});
    console.log(`  ✓ Deleted ${oemCount} OEMs`);

    // Clear uploads directory
    const uploadsDir = path.join(__dirname, '../../uploads/traces');
    if (fs.existsSync(uploadsDir)) {
      console.log('\nClearing uploads/traces directory...');
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
      console.log(`  ✓ Deleted ${files.length} files from uploads/traces`);
    }

    console.log('\n===========================================');
    console.log('   Cleanup Complete!');
    console.log('===========================================');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  cleanDatabase();
}

module.exports = { cleanDatabase };