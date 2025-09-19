const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function clearData() {
  console.log('Clearing all data except users...')

  try {
    // Delete in reverse order of dependencies
    await prisma.oDXDiscoveryResult.deleteMany()
    console.log('Deleted ODXDiscoveryResult')

    await prisma.doipMessage.deleteMany()
    console.log('Deleted DoipMessage')

    await prisma.ecu.deleteMany()
    console.log('Deleted Ecu')

    await prisma.diagnosticService.deleteMany()
    console.log('Deleted DiagnosticService')

    await prisma.traceSession.deleteMany()
    console.log('Deleted TraceSession')

    await prisma.diagnosticJob.deleteMany()
    console.log('Deleted DiagnosticJob')

    await prisma.vehicle.deleteMany()
    console.log('Deleted Vehicle')

    await prisma.eCUMapping.deleteMany()
    console.log('Deleted ECUMapping')

    await prisma.modelYear.deleteMany()
    console.log('Deleted ModelYear')

    await prisma.model.deleteMany()
    console.log('Deleted Model')

    await prisma.oEM.deleteMany()
    console.log('Deleted OEM')

    await prisma.tag.deleteMany()
    console.log('Deleted Tag')

    // Clear ODX related tables
    await prisma.baseVariant.deleteMany()
    console.log('Deleted BaseVariant')

    await prisma.eCUVariant.deleteMany()
    console.log('Deleted ECUVariant')

    await prisma.diagnosticLayer.deleteMany()
    console.log('Deleted DiagnosticLayer')

    await prisma.company.deleteMany()
    console.log('Deleted Company')

    console.log('All data cleared except users!')
  } catch (error) {
    console.error('Error clearing data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearData()