const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCategories() {
  console.log('Checking OBD-II DTC categories...\n');

  try {
    // Get category distribution
    const categoryStats = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['category'],
      _count: true
    });

    console.log('Category distribution:');
    categoryStats.forEach(stat => {
      console.log(`  ${stat.category || 'NULL'}: ${stat._count}`);
    });

    // Count nulls specifically
    const nullCount = await prisma.oBDIIDTCDefinition.count({
      where: { category: null }
    });

    const totalCount = await prisma.oBDIIDTCDefinition.count();

    console.log(`\nTotal DTCs: ${totalCount}`);
    console.log(`DTCs without category: ${nullCount} (${(nullCount/totalCount * 100).toFixed(1)}%)`);

    // Show some examples of DTCs without categories
    if (nullCount > 0) {
      const examples = await prisma.oBDIIDTCDefinition.findMany({
        where: { category: null },
        take: 10
      });

      console.log('\nExample DTCs without categories:');
      examples.forEach(dtc => {
        console.log(`  ${dtc.code} (${dtc.system}): ${dtc.name}`);
      });
    }

  } catch (error) {
    console.error('Error checking categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkCategories();
}

module.exports = checkCategories;