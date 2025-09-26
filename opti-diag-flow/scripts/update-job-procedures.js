const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapping of job names to their procedure types based on known directory structure
const PROCEDURE_MAPPINGS = {
  // Fiat
  '8898249': 'General Diagnostic', // No procedure folder

  // Ford
  '8899977': 'General Diagnostic', // No procedure folder
  'EA25MUB_TRANSIT_CAMERA_CARYUK_LOG': 'Dynamic Front Camera Calibration',
  'EJ79793_TRANSIT_CAMERA_DANSKBILGLAS_LOG': 'Dynamic Front Camera Calibration',

  // Honda
  '8901379': 'General Diagnostic', // No procedure folder
  'HONDA_JAZZ_CAM_RYDS': 'Camera Calibration',

  // Hyundai
  '8882747': 'Camera Calibration',
  '8899458': 'General Diagnostic', // No procedure folder
  'EJ25LZU_KONA_CAMERA_ALLSCREENS_LOG': 'Static Front Camera Calibration',

  // Kia
  '8898588': 'Front Radar Calibration',
  '8899553': 'General Diagnostic', // No procedure folder
  '8898166': 'General Diagnostic', // No procedure folder

  // Land Rover
  '8873778': 'Camera Calibration',
  '8884157': 'Static Front Camera Calibration',
  'LANDROVER_DISCO_CAM_CARY': 'Static Front Camera Calibration',
  'L4EXA_DISCOVERY_CAMERA_CARYUK_LOG': 'Static Front Camera Calibration',
  '8898268': 'General Diagnostic', // No procedure folder
  '8896252': 'General Diagnostic', // No procedure folder

  // Mercedes-Benz
  'GY73RHK_MERCEDESBENZ_CAMERA_CARYUK_LOG': 'Dynamic Front Camera Calibration',
  '8898301': 'General Diagnostic', // No procedure folder
  '8899173': 'General Diagnostic', // No procedure folder

  // MG
  '8884494': 'Camera Calibration',

  // Mitsubishi
  '8903321': 'General Diagnostic', // No procedure folder

  // Nissan
  '8899572': 'General Diagnostic', // No procedure folder
  '8882943': 'Camera Calibration',

  // Polestar
  '8875011': 'Camera calibration',
  'OW74CRX_POLESTAR_CAMERA_CARYUK_LOG': 'Static Front Camera Calibration',

  // Toyota
  '8885638': 'Camera Calibration',

  // Vauxhall
  '8899333': 'General Diagnostic', // No procedure folder

  // Volkswagen
  '8901243': 'General Diagnostic', // No procedure folder

  // Volvo
  'YN72OGH_VOLVO_CAMERA_CARYUK_LOG': 'Static Front Camera Calibration',
  '8898334': 'General Diagnostic', // No procedure folder in path
  'WJ71YHO_XC90_CAMERA_CARYUK_LOG': 'Static Front Camera Calibration',
  'BN73UDH_XC90_CAMERA_HUGGINS_LOG': 'Static Front Camera Calibration',
  'YW23BTX_XC90_CAMERA_ALLSCREENS_LOG': 'Static Front Camera Calibration'
};

async function updateJobProcedures() {
  console.log('===========================================');
  console.log('   Updating Job Procedure Types');
  console.log('===========================================');

  try {
    // Get all jobs
    const jobs = await prisma.diagnosticJob.findMany({
      select: {
        id: true,
        name: true,
        procedureType: true
      }
    });

    console.log(`\nFound ${jobs.length} jobs to update`);

    let updated = 0;
    let skipped = 0;

    for (const job of jobs) {
      const newProcedureType = PROCEDURE_MAPPINGS[job.name];

      if (!newProcedureType) {
        console.log(`  ⚠ No mapping found for job: ${job.name}`);
        skipped++;
        continue;
      }

      if (job.procedureType === newProcedureType) {
        console.log(`  ✓ Job ${job.name} already has correct procedure: ${newProcedureType}`);
        skipped++;
        continue;
      }

      console.log(`  Updating job ${job.name}: "${job.procedureType}" → "${newProcedureType}"`);
      await prisma.diagnosticJob.update({
        where: { id: job.id },
        data: { procedureType: newProcedureType }
      });
      updated++;
    }

    console.log('\n===========================================');
    console.log(`   Update Complete!`);
    console.log(`   Updated: ${updated} jobs`);
    console.log(`   Skipped: ${skipped} jobs`);
    console.log('===========================================');

  } catch (error) {
    console.error('Error updating job procedures:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  updateJobProcedures();
}

module.exports = { updateJobProcedures };