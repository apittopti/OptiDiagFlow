const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Correct B0000-B0099 codes - these are standard airbag/SRS codes
const correctBCodes = [
  { code: 'B0001', name: 'Driver Frontal Stage 1 Deployment Loop', description: 'Driver Frontal Stage 1 Deployment Loop (Single Stage or Stage 1) Resistance Low' },
  { code: 'B0002', name: 'Driver Frontal Stage 1 Deployment Loop', description: 'Driver Frontal Stage 1 Deployment Loop (Single Stage or Stage 1) Open' },
  { code: 'B0003', name: 'Driver Frontal Stage 1 Deployment Loop', description: 'Driver Frontal Stage 1 Deployment Loop (Single Stage or Stage 1) Short to Ground/Voltage Out of Range' },
  { code: 'B0004', name: 'Driver Frontal Stage 2 Deployment Loop', description: 'Driver Frontal Stage 2 Deployment Loop Open' },
  { code: 'B0005', name: 'Collision Zone Sensor', description: 'Collision Zone Sensor' },
  { code: 'B0010', name: 'Passenger Frontal Deployment Loop', description: 'Passenger Frontal Deployment Loop Circuit' },
  { code: 'B0011', name: 'Passenger Frontal Deployment Loop', description: 'Passenger Frontal Deployment Loop Circuit' },
  { code: 'B0012', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop Circuit' },
  { code: 'B0013', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop Circuit' },
  { code: 'B0014', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop Circuit' },
  { code: 'B0016', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop (Single Stage or Stage 1) Resistance Low' },
  { code: 'B0017', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop (Single Stage or Stage 1) Open' },
  { code: 'B0018', name: 'Passenger Frontal Deployment Loop', description: 'Right Front/Passenger Frontal Deployment Loop (Single Stage or Stage 1) Short to Ground/Voltage Out of Range' },
  { code: 'B0020', name: 'Driver Side Deployment Loop', description: 'Left Front/Driver Side Deployment Loop Circuit' },
  { code: 'B0021', name: 'Driver Frontal Deployment Loop', description: 'Left Front/Driver Frontal Deployment Loop Circuit' },
  { code: 'B0022', name: 'Driver Frontal Deployment Loop', description: 'Left Front/Driver Frontal Deployment Loop (Single Stage or Stage 1) Resistance Low' },
  { code: 'B0024', name: 'Driver Frontal Deployment Loop', description: 'Left Front/Driver Frontal Deployment Loop (Single Stage or Stage 1) Short to Ground/Voltage Out of Range' }
];

async function fixBCodes() {
  console.log('Fixing B-code DTC descriptions...\n');

  try {
    // Check and update each code
    for (const correct of correctBCodes) {
      const existing = await prisma.oBDIIDTCDefinition.findFirst({
        where: { code: correct.code }
      });

      if (existing) {
        console.log(`Checking ${correct.code}...`);
        console.log(`  Current: ${existing.name}`);

        if (existing.name !== correct.name || existing.description !== correct.description) {
          await prisma.oBDIIDTCDefinition.update({
            where: { code: correct.code },
            data: {
              name: correct.name,
              description: correct.description,
              category: 'Airbag and Supplemental Restraint Systems'
            }
          });
          console.log(`  ✅ Updated to: ${correct.name}`);
        } else {
          console.log(`  ✓ Already correct`);
        }
      }
    }

    // Also check for any other suspicious descriptions
    console.log('\nChecking for other potentially incorrect B-codes...');

    // Find B-codes with "PCM" in the description (unlikely for Body codes)
    const suspiciousCodes = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        AND: [
          { code: { startsWith: 'B' } },
          {
            OR: [
              { name: { contains: 'PCM' } },
              { description: { contains: 'PCM' } }
            ]
          }
        ]
      },
      orderBy: { code: 'asc' }
    });

    if (suspiciousCodes.length > 0) {
      console.log(`\n⚠️  Found ${suspiciousCodes.length} B-codes with PCM references:`);
      suspiciousCodes.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`);
      });
    }

    console.log('\n✅ B-code verification complete!');

  } catch (error) {
    console.error('Error fixing B-codes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixBCodes();
}

module.exports = fixBCodes;