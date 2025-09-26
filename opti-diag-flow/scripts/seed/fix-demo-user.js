const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Fixing demo user with correct ID...')

  // Delete any existing demo user first
  try {
    await prisma.user.deleteMany({
      where: { email: 'demo@optiflow.com' }
    })
    console.log('Deleted existing demo user')
  } catch (error) {
    console.log('No existing demo user to delete')
  }

  // Create demo user with the specific ID from the JWT session
  const hashedPassword = await bcrypt.hash('demo123', 12)

  const user = await prisma.user.create({
    data: {
      id: 'cmfmpqn4q0000ucjssabwvvxn', // The ID from the JWT session
      email: 'demo@optiflow.com',
      name: 'Demo User',
      password: hashedPassword,
      role: 'ADMIN'
    }
  })

  console.log('Created demo user with correct ID:', user.id)
  console.log('User email:', user.email)
  console.log('User role:', user.role)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })