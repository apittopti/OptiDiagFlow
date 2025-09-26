const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Correct procedure mappings based on actual directory structure
const CORRECT_PROCEDURES = {
  '8898249': 'Static Front Camera Calibration',
  '8899977': 'Dynamic Camera Calibration',
  '8901379': 'Static Front Camera Calibration',
  '8899458': 'Dynamic Front Camera Calibration',
  '8899553': 'Dynamic Front Camera Calibration',
  '8898166': 'Front Camera Calibration',
  '8898268': 'Dynamic Front Camera Calibration',
  '8896252': 'Dynamic Front Camera Calibration',
  '8898301': 'Static Front Camera Calibration',
  '8899173': 'Static Front Camera Calibration',
  '8903321': 'Dynamic Camera Calibration',
  '8899572': 'Static Front Camera Calibration',
  '8899333': 'Dynamic Front Camera Calibration',
  '8901243': 'Dynamic Front Camera Calibration',
  '8898334': 'General Diagnostic' // This one actually has no procedure folder
};

async function fixRemainingProcedures() {
  console.log('===========================================');
  console.log('   Fixing Remaining Procedure Types');
  console.log('===========================================\n');

  try {
    let updated = 0;
    let skipped = 0;

    for (const [jobName, correctProcedure] of Object.entries(CORRECT_PROCEDURES)) {
      const job = await prisma.diagnosticJob.findFirst({
        where: { name: jobName },
        select: {
          id: true,
          name: true,
          procedureType: true
        }
      });

      if (!job) {
        console.log(`  ⚠ Job not found: ${jobName}`);
        skipped++;
        continue;
      }

      if (job.procedureType === correctProcedure) {
        console.log(`  ✓ Job ${jobName} already correct: ${correctProcedure}`);
        skipped++;
        continue;
      }

      console.log(`  Updating job ${jobName}: "${job.procedureType}" → "${correctProcedure}"`);
      await prisma.diagnosticJob.update({
        where: { id: job.id },
        data: { procedureType: correctProcedure }
      });
      updated++;
    }

    console.log('\n===========================================');
    console.log(`   Update Complete!`);
    console.log(`   Updated: ${updated} jobs`);
    console.log(`   Skipped: ${skipped} jobs`);
    console.log('===========================================');

  } catch (error) {
    console.error('Error updating procedures:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixRemainingProcedures();
}

module.exports = { fixRemainingProcedures };