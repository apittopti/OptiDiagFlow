const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo data...')

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'demo@optiflow.com' },
    update: {},
    create: {
      email: 'demo@optiflow.com',
      name: 'Demo User',
      password: hashedPassword,
      role: 'ADMIN'
    }
  })

  console.log('Created demo user:', user.email)

  // Create sample OEMs
  const bmwOEM = await prisma.oEM.upsert({
    where: { name: 'BMW' },
    update: {},
    create: {
      name: 'BMW',
      shortName: 'BMW'
    }
  })

  const audiOEM = await prisma.oEM.upsert({
    where: { name: 'Audi' },
    update: {},
    create: {
      name: 'Audi',
      shortName: 'AUD'
    }
  })

  const mercedesOEM = await prisma.oEM.upsert({
    where: { name: 'Mercedes-Benz' },
    update: {},
    create: {
      name: 'Mercedes-Benz',
      shortName: 'MB'
    }
  })

  console.log('Created sample OEMs')

  // Create sample Models
  const models = [
    { oemId: bmwOEM.id, name: 'X5', platform: 'G05' },
    { oemId: bmwOEM.id, name: '3 Series', platform: 'G20' },
    { oemId: audiOEM.id, name: 'A4', platform: 'B9' },
    { oemId: audiOEM.id, name: 'Q7', platform: '4M' },
    { oemId: mercedesOEM.id, name: 'C-Class', platform: 'W206' },
    { oemId: mercedesOEM.id, name: 'S-Class', platform: 'W223' }
  ]

  for (const modelData of models) {
    await prisma.model.upsert({
      where: {
        oemId_name: {
          oemId: modelData.oemId,
          name: modelData.name
        }
      },
      update: {},
      create: modelData
    })
  }

  console.log('Created sample Models')
  console.log('Demo data seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })