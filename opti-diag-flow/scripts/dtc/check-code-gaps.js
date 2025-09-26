const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCodeGaps() {
  console.log('Checking for gaps in OBD-II code sequences...\n');

  try {
    // Get all codes and sort them
    const allCodes = await prisma.oBDIIDTCDefinition.findMany({
      select: { code: true },
      orderBy: { code: 'asc' }
    });

    const codesByPrefix = {
      P: [],
      B: [],
      C: [],
      U: []
    };

    // Group codes by prefix
    allCodes.forEach(({ code }) => {
      const prefix = code[0];
      const num = parseInt(code.substring(1));
      if (codesByPrefix[prefix]) {
        codesByPrefix[prefix].push(num);
      }
    });

    // Check for gaps in each prefix
    for (const [prefix, nums] of Object.entries(codesByPrefix)) {
      nums.sort((a, b) => a - b);

      console.log(`\n${prefix}-codes: ${nums.length} total`);
      console.log(`  Range: ${prefix}${nums[0].toString().padStart(4, '0')} - ${prefix}${nums[nums.length - 1].toString().padStart(4, '0')}`);

      // Find gaps
      const gaps = [];
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] - nums[i - 1] > 1) {
          const gapStart = nums[i - 1] + 1;
          const gapEnd = nums[i] - 1;
          if (gapEnd - gapStart < 100) { // Only show smaller gaps
            gaps.push({
              start: `${prefix}${gapStart.toString().padStart(4, '0')}`,
              end: `${prefix}${gapEnd.toString().padStart(4, '0')}`,
              count: gapEnd - gapStart + 1
            });
          }
        }
      }

      if (gaps.length > 0) {
        console.log(`  Found ${gaps.length} gaps:`);
        gaps.slice(0, 10).forEach(gap => {
          if (gap.count === 1) {
            console.log(`    Missing: ${gap.start}`);
          } else {
            console.log(`    Missing: ${gap.start} - ${gap.end} (${gap.count} codes)`);
          }
        });
        if (gaps.length > 10) {
          console.log(`    ... and ${gaps.length - 10} more gaps`);
        }
      }
    }

    // Check specific important ranges
    console.log('\n\nChecking important generic OBD-II ranges:');

    // P0000-P0099 should mostly exist
    const p0000Range = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P0000',
          lte: 'P0099'
        }
      }
    });
    console.log(`  P0000-P0099: ${p0000Range}/100 codes present`);

    // P0100-P0199 (MAF/MAP sensors)
    const p0100Range = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P0100',
          lte: 'P0199'
        }
      }
    });
    console.log(`  P0100-P0199: ${p0100Range}/100 codes present`);

    // P0200-P0299 (Fuel injection)
    const p0200Range = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P0200',
          lte: 'P0299'
        }
      }
    });
    console.log(`  P0200-P0299: ${p0200Range}/100 codes present`);

    // P0300-P0399 (Ignition/Misfire)
    const p0300Range = await prisma.oBDIIDTCDefinition.count({
      where: {
        code: {
          gte: 'P0300',
          lte: 'P0399'
        }
      }
    });
    console.log(`  P0300-P0399: ${p0300Range}/100 codes present`);

    const totalCodes = await prisma.oBDIIDTCDefinition.count();
    console.log(`\nTotal OBD-II DTCs in database: ${totalCodes}`);

  } catch (error) {
    console.error('Error checking code gaps:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkCodeGaps();
}

module.exports = checkCodeGaps;