const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDurations() {
  console.log('Fixing duration fields for existing jobs...\n');

  try {
    // Get all jobs
    const jobs = await prisma.diagnosticJob.findMany({
      select: {
        id: true,
        name: true,
        duration: true,
        metadata: true
      }
    });

    console.log(`Found ${jobs.length} jobs to check\n`);

    let updated = 0;
    for (const job of jobs) {
      const metadataDuration = job.metadata?.duration;

      // If job doesn't have duration but metadata does
      if ((!job.duration || job.duration === 0) && metadataDuration) {
        console.log(`Updating job "${job.name}" - Setting duration to ${metadataDuration}ms`);

        await prisma.diagnosticJob.update({
          where: { id: job.id },
          data: { duration: metadataDuration }
        });

        updated++;
      }
    }

    console.log(`\nFixed ${updated} jobs with missing duration`);

    // Verify the fix
    const stillMissing = await prisma.diagnosticJob.count({
      where: {
        OR: [
          { duration: null },
          { duration: 0 }
        ]
      }
    });

    if (stillMissing > 0) {
      console.log(`\n⚠️  ${stillMissing} jobs still have no duration (might not have metadata.duration either)`);
    } else {
      console.log('\n✅ All jobs now have duration values!');
    }

  } catch (error) {
    console.error('Error fixing durations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixDurations();
}

module.exports = fixDurations;