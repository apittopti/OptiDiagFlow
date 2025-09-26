const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkOBDIIDTCs() {
  try {
    // Check if OBDIIDTCDefinition table exists and has data
    const count = await prisma.oBDIIDTCDefinition.count()
    console.log(`Total OBD-II DTCs in database: ${count}`)

    if (count > 0) {
      // Get a sample of DTCs
      const sample = await prisma.oBDIIDTCDefinition.findMany({
        take: 5,
        orderBy: { code: 'asc' }
      })

      console.log('\nSample OBD-II DTCs:')
      sample.forEach(dtc => {
        console.log(`  ${dtc.code}: ${dtc.name}`)
      })
    } else {
      console.log('\nNo OBD-II DTCs found in database!')
      console.log('You may need to run: node prisma/seed-obdii-dtcs.js')
    }
  } catch (error) {
    console.error('Error checking OBD-II DTCs:', error.message)
    if (error.code === 'P2002') {
      console.log('The OBDIIDTCDefinition table may not exist. Run: npm run db:push')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkOBDIIDTCs()