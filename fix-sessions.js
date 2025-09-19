const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing old sessions...')

  // Delete all sessions to force fresh login
  await prisma.session.deleteMany({})

  // Show current users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true }
  })

  console.log('Current users in database:', users)
  console.log('All sessions cleared. Users will need to log in again.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })