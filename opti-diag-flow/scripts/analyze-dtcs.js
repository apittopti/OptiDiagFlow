const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeJobDTCs() {
  console.log('===========================================');
  console.log('   Analyzing Jobs for DTC Types');
  console.log('===========================================');

  try {
    const jobs = await prisma.diagnosticJob.findMany({
      select: {
        id: true,
        name: true,
        metadata: true,
        Vehicle: {
          select: {
            ModelYear: {
              select: {
                year: true,
                Model: {
                  select: {
                    name: true,
                    OEM: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const jobsWithDTCs = [];
    const jobsWithBothTypes = [];

    for (const job of jobs) {
      const dtcs = job.metadata?.dtcs || {};
      const ecuCount = Object.keys(dtcs).length;

      if (ecuCount > 0) {
        let totalDTCs = 0;
        const obdCodes = [];
        const udsCodes = [];
        const allDTCs = [];

        for (const [ecuName, ecuDtcs] of Object.entries(dtcs)) {
          if (Array.isArray(ecuDtcs)) {
            totalDTCs += ecuDtcs.length;
            ecuDtcs.forEach(dtc => {
              const code = dtc.code || '';
              allDTCs.push({ ecu: ecuName, code, description: dtc.description });

              // OBD-II codes: P0xxx-P0xxx, P2xxx, P34xx
              if (code.match(/^P0[0-9A-F]{3}/i) ||
                  code.match(/^P2[0-9A-F]{3}/i) ||
                  code.match(/^P34[0-9A-F]{2}/i)) {
                obdCodes.push(code);
              }
              // UDS codes: B, C, U codes and P codes outside OBD-II range
              else if (code.match(/^[BCU][0-9A-F]{4}/i) ||
                       code.match(/^P[1,4-9,A-F][0-9A-F]{3}/i)) {
                udsCodes.push(code);
              }
            });
          }
        }

        const vehicle = job.Vehicle?.ModelYear;
        const vehicleInfo = vehicle
          ? `${vehicle.Model.OEM.name} ${vehicle.Model.name} ${vehicle.year}`
          : 'Unknown';

        const jobInfo = {
          id: job.id,
          name: job.name,
          vehicle: vehicleInfo,
          ecuCount,
          totalDTCs,
          obdCount: obdCodes.length,
          udsCount: udsCodes.length,
          hasBoth: obdCodes.length > 0 && udsCodes.length > 0,
          obdCodes: obdCodes.slice(0, 5), // First 5 examples
          udsCodes: udsCodes.slice(0, 5), // First 5 examples
          allDTCs: allDTCs.slice(0, 10) // First 10 for review
        };

        jobsWithDTCs.push(jobInfo);
        if (jobInfo.hasBoth) {
          jobsWithBothTypes.push(jobInfo);
        }
      }
    }

    // Display results
    console.log(`\nTotal jobs analyzed: ${jobs.length}`);
    console.log(`Jobs with DTCs: ${jobsWithDTCs.length}`);
    console.log(`Jobs with BOTH OBD-II and UDS DTCs: ${jobsWithBothTypes.length}`);

    if (jobsWithBothTypes.length > 0) {
      console.log('\n=== JOBS WITH BOTH OBD-II AND UDS DTCs ===');
      jobsWithBothTypes.forEach(job => {
        console.log(`\n📋 Job: ${job.name} (ID: ${job.id})`);
        console.log(`   Vehicle: ${job.vehicle}`);
        console.log(`   Total DTCs: ${job.totalDTCs} (OBD-II: ${job.obdCount}, UDS: ${job.udsCount})`);
        console.log(`   Sample OBD-II codes: ${job.obdCodes.join(', ')}`);
        console.log(`   Sample UDS codes: ${job.udsCodes.join(', ')}`);
      });
    }

    // Show all jobs with DTCs
    console.log('\n=== ALL JOBS WITH DTCs ===');
    jobsWithDTCs.forEach(job => {
      console.log(`\n📋 Job: ${job.name}`);
      console.log(`   Vehicle: ${job.vehicle}`);
      console.log(`   Total DTCs: ${job.totalDTCs} (OBD-II: ${job.obdCount}, UDS: ${job.udsCount})`);
      if (job.totalDTCs > 0) {
        console.log(`   Sample DTCs:`);
        job.allDTCs.slice(0, 3).forEach(dtc => {
          console.log(`     - ${dtc.code} from ${dtc.ecu}`);
        });
      }
    });

  } catch (error) {
    console.error('Error analyzing DTCs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  analyzeJobDTCs();
}

module.exports = { analyzeJobDTCs };