const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Category mapping based on DTC descriptions and codes
const categoryPatterns = {
  // Powertrain categories
  'Fuel and Air Metering': [
    /fuel/i, /injector/i, /air.*flow/i, /maf/i, /map sensor/i, /throttle/i,
    /intake/i, /manifold.*pressure/i, /fuel.*pressure/i, /fuel.*pump/i,
    /fuel.*trim/i, /fuel.*system/i, /air.*fuel/i, /afr/i
  ],
  'Ignition System or Misfire': [
    /ignition/i, /misfire/i, /spark/i, /coil/i, /cylinder.*\d/i,
    /combustion/i, /knock/i, /detonation/i
  ],
  'Auxiliary Emission Controls': [
    /emission/i, /evap/i, /egr/i, /purge/i, /canister/i, /vapor/i,
    /secondary.*air/i, /catalyst/i, /catalytic/i, /o2.*sensor/i,
    /oxygen.*sensor/i, /nox/i, /dpf/i, /scr/i, /adblue/i, /def/i,
    /particulate/i, /soot/i
  ],
  'Vehicle Speed Controls and Idle Control System': [
    /vehicle.*speed/i, /vss/i, /idle/i, /iac/i, /idle.*control/i,
    /cruise.*control/i, /speed.*control/i
  ],
  'Computer Output Circuit': [
    /pcm/i, /ecm/i, /ecu/i, /module.*performance/i, /computer/i,
    /processor/i, /control.*module/i, /internal.*control/i
  ],
  'Transmission': [
    /transmission/i, /gear/i, /shift/i, /clutch/i, /torque.*converter/i,
    /solenoid/i, /pressure.*control/i, /tcm/i, /cvt/i, /transfer.*case/i,
    /differential/i, /4wd/i, /awd/i, /axle/i
  ],

  // Body categories
  'Airbag and Supplemental Restraint Systems': [
    /airbag/i, /srs/i, /restraint/i, /deployment/i, /pretensioner/i,
    /seat.*belt/i, /crash/i, /impact/i, /occupant/i, /inflat/i
  ],
  'Climate Control': [
    /ac/i, /air.*condition/i, /climate/i, /heater/i, /hvac/i,
    /refrigerant/i, /compressor/i, /evaporator/i, /blend.*door/i,
    /temperature.*sensor/i, /cabin.*temp/i
  ],
  'Lighting': [
    /lamp/i, /light/i, /headl/i, /tail/i, /turn.*signal/i, /indicator/i,
    /fog.*lamp/i, /beam/i, /led/i, /bulb/i, /hid/i, /xenon/i
  ],
  'Security and Access': [
    /immobiliz/i, /security/i, /theft/i, /alarm/i, /key/i, /lock/i,
    /door/i, /window/i, /trunk/i, /hood/i, /liftgate/i, /tailgate/i,
    /remote/i, /fob/i, /access/i, /entry/i
  ],
  'Instrumentation': [
    /instrument/i, /gauge/i, /speedometer/i, /tachometer/i, /fuel.*gauge/i,
    /temperature.*gauge/i, /odometer/i, /trip/i, /display/i, /cluster/i,
    /indicator/i, /warning/i
  ],

  // Chassis categories
  'ABS and Traction Control': [
    /abs/i, /anti.*lock/i, /brake/i, /traction/i, /stability/i,
    /esp/i, /vsc/i, /wheel.*speed/i, /yaw/i, /lateral/i, /skid/i
  ],
  'Steering': [
    /steering/i, /eps/i, /power.*steering/i, /rack/i, /pinion/i,
    /steering.*angle/i, /torque.*sensor/i, /column/i
  ],
  'Suspension': [
    /suspension/i, /damper/i, /shock/i, /strut/i, /spring/i,
    /level/i, /ride.*height/i, /air.*suspension/i
  ],

  // Network categories
  'CAN Communication': [
    /can/i, /bus/i, /network/i, /communication/i, /lin/i, /flexray/i,
    /most/i, /ethernet/i, /gateway/i
  ],
  'Lost Communication with Module': [
    /lost.*communication/i, /no.*communication/i, /module.*offline/i,
    /timeout/i, /no.*response/i, /missing.*message/i
  ],

  // Generic fallback
  'Manufacturer Specific': []  // Will be used for manufacturer-specific codes without clear category
};

async function assignCategories() {
  console.log('Assigning categories to OBD-II DTCs...\n');

  try {
    // Get all DTCs without categories
    const dtcsWithoutCategory = await prisma.oBDIIDTCDefinition.findMany({
      where: { category: null }
    });

    console.log(`Found ${dtcsWithoutCategory.length} DTCs without categories`);

    const updates = [];
    const categoryCount = {};

    for (const dtc of dtcsWithoutCategory) {
      let category = null;
      const description = (dtc.name + ' ' + (dtc.description || '')).toLowerCase();

      // Try to match against patterns
      for (const [cat, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(pattern => pattern.test(description))) {
          category = cat;
          break;
        }
      }

      // If no pattern matched, use defaults based on code and type
      if (!category) {
        if (!dtc.isGeneric) {
          category = 'Manufacturer Specific';
        } else {
          // Default categories based on system
          switch (dtc.system) {
            case 'Powertrain':
              category = 'Fuel and Air Metering and Auxiliary Emission Controls';
              break;
            case 'Body':
              category = 'Body Electrical';
              break;
            case 'Chassis':
              category = 'Chassis';
              break;
            case 'Network':
              category = 'CAN Communication';
              break;
            default:
              category = 'Manufacturer Specific';
          }
        }
      }

      updates.push({ code: dtc.code, category });
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    }

    console.log('\nCategories to assign:');
    for (const [cat, count] of Object.entries(categoryCount)) {
      console.log(`  ${cat}: ${count}`);
    }

    // Update in batches
    console.log('\nUpdating database...');
    const batchSize = 100;
    let updated = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Update each DTC in the batch
      for (const update of batch) {
        await prisma.oBDIIDTCDefinition.update({
          where: { code: update.code },
          data: { category: update.category }
        });
      }

      updated += batch.length;
      console.log(`  Updated ${updated}/${updates.length} DTCs...`);
    }

    // Verify final distribution
    console.log('\nFinal category distribution:');
    const finalStats = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: { category: 'desc' } }
    });

    finalStats.forEach(stat => {
      console.log(`  ${stat.category || 'NULL'}: ${stat._count}`);
    });

    const totalCount = await prisma.oBDIIDTCDefinition.count();
    const withCategory = await prisma.oBDIIDTCDefinition.count({
      where: { category: { not: null } }
    });

    console.log(`\n✅ Categories assigned! ${withCategory}/${totalCount} DTCs now have categories (${(withCategory/totalCount * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('Error assigning categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  assignCategories();
}

module.exports = assignCategories;