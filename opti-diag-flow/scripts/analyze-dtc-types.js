const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeDTCTypes() {
  console.log('===========================================');
  console.log('   Analyzing DTC Types by Job');
  console.log('===========================================\n');

  try {
    // Get all jobs with DTCs
    const jobsWithDTCs = await prisma.diagnosticJob.findMany({
      where: {
        DTC: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        Vehicle: {
          select: {
            ModelYear: {
              select: {
                year: true,
                Model: {
                  select: {
                    name: true,
                    OEM: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        },
        DTC: {
          select: {
            code: true,
            description: true,
            ecuName: true
          }
        }
      }
    });

    const jobsWithBothTypes = [];

    for (const job of jobsWithDTCs) {
      const obdCodes = [];
      const udsCodes = [];
      const unknownCodes = [];

      job.DTC.forEach(dtc => {
        const code = dtc.code || '';

        // OBD-II codes: P0xxx, P2xxx, P34xx (standard OBD-II ranges)
        if (code.match(/^P0[0-9A-F]{3}/i) ||
            code.match(/^P2[0-9A-F]{3}/i) ||
            code.match(/^P34[0-9A-F]{2}/i)) {
          obdCodes.push({ code, ecu: dtc.ecuName });
        }
        // UDS codes: B, C, U codes and P codes outside OBD-II range
        else if (code.match(/^[BCU][0-9A-F]{4}/i) ||
                 code.match(/^P[1,3-9,A-F][0-9A-F]{3}/i) && !code.match(/^P34/i)) {
          udsCodes.push({ code, ecu: dtc.ecuName });
        }
        // Unknown format
        else if (code) {
          unknownCodes.push({ code, ecu: dtc.ecuName });
        }
      });

      const vehicle = job.Vehicle?.ModelYear;
      const vehicleInfo = vehicle
        ? `${vehicle.Model.OEM.name} ${vehicle.Model.name} ${vehicle.year}`
        : 'Unknown';

      const hasBoth = obdCodes.length > 0 && udsCodes.length > 0;

      if (hasBoth) {
        jobsWithBothTypes.push({
          id: job.id,
          name: job.name,
          vehicle: vehicleInfo,
          totalDTCs: job.DTC.length,
          obdCount: obdCodes.length,
          udsCount: udsCodes.length,
          unknownCount: unknownCodes.length,
          obdSamples: obdCodes.slice(0, 3),
          udsSamples: udsCodes.slice(0, 3)
        });
      }

      // Display all jobs with analysis
      console.log(`📋 Job: ${job.name}`);
      console.log(`   Vehicle: ${vehicleInfo}`);
      console.log(`   Total DTCs: ${job.DTC.length}`);
      console.log(`   - OBD-II codes: ${obdCodes.length}`);
      console.log(`   - UDS codes: ${udsCodes.length}`);
      if (unknownCodes.length > 0) {
        console.log(`   - Unknown format: ${unknownCodes.length}`);
      }

      if (hasBoth) {
        console.log(`   ✅ HAS BOTH OBD-II AND UDS DTCs`);
        console.log(`   Sample OBD-II: ${obdCodes.slice(0, 3).map(d => d.code).join(', ')}`);
        console.log(`   Sample UDS: ${udsCodes.slice(0, 3).map(d => d.code).join(', ')}`);
      } else if (obdCodes.length > 0) {
        console.log(`   Type: OBD-II only`);
        console.log(`   Samples: ${obdCodes.slice(0, 5).map(d => d.code).join(', ')}`);
      } else if (udsCodes.length > 0) {
        console.log(`   Type: UDS only`);
        console.log(`   Samples: ${udsCodes.slice(0, 5).map(d => d.code).join(', ')}`);
      }
      console.log('');
    }

    console.log('===========================================');
    console.log(`SUMMARY: ${jobsWithBothTypes.length} jobs have BOTH OBD-II and UDS DTCs`);
    console.log('===========================================\n');

    if (jobsWithBothTypes.length > 0) {
      console.log('Best jobs for validating DTC tab with mixed types:\n');
      jobsWithBothTypes.forEach(job => {
        console.log(`✅ ${job.name} (${job.vehicle})`);
        console.log(`   - ${job.obdCount} OBD-II codes`);
        console.log(`   - ${job.udsCount} UDS codes`);
        console.log(`   - Total: ${job.totalDTCs} DTCs\n`);
      });
    }

  } catch (error) {
    console.error('Error analyzing DTCs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  analyzeDTCTypes();
}

module.exports = { analyzeDTCTypes };