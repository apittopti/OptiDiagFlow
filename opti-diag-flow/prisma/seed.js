const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 10)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@optiflow.com' },
    update: {},
    create: {
      email: 'demo@optiflow.com',
      name: 'Demo User',
      password: hashedPassword,
      role: 'ADMIN'
    }
  })
  console.log('✅ Created demo user:', demoUser.email)

  // Create OEMs
  const oems = [
    { name: 'Land Rover', shortName: 'LR' },
    { name: 'BMW', shortName: 'BMW' },
    { name: 'Mercedes-Benz', shortName: 'MB' },
    { name: 'Audi', shortName: 'AUDI' },
    { name: 'Volvo', shortName: 'VOLVO' },
    { name: 'Polestar', shortName: 'PS' },
    { name: 'Ford', shortName: 'FORD' }
  ]

  for (const oemData of oems) {
    const oem = await prisma.oEM.upsert({
      where: { name: oemData.name },
      update: {},
      create: oemData
    })
    console.log('✅ Created OEM:', oem.name)

    // Create some models for each OEM
    if (oemData.name === 'Land Rover') {
      const defenderModel = await prisma.model.upsert({
        where: { code: 'LR_DEFENDER' },
        update: {},
        create: {
          oemId: oem.id,
          name: 'Defender',
          code: 'LR_DEFENDER',
          platform: 'L663'
        }
      })

      // Create model year for Defender 2020
      await prisma.modelYear.upsert({
        where: { code: 'LR_DEFENDER_2020' },
        update: {},
        create: {
          modelId: defenderModel.id,
          year: 2020,
          code: 'LR_DEFENDER_2020'
        }
      })
    }

    if (oemData.name === 'Polestar') {
      const polestar2Model = await prisma.model.upsert({
        where: { code: 'PS_POLESTAR2' },
        update: {},
        create: {
          oemId: oem.id,
          name: 'Polestar 2',
          code: 'PS_POLESTAR2',
          platform: 'CMA'
        }
      })

      // Create model year for Polestar 2 2022
      await prisma.modelYear.upsert({
        where: { code: 'PS_POLESTAR2_2022' },
        update: {},
        create: {
          modelId: polestar2Model.id,
          year: 2022,
          code: 'PS_POLESTAR2_2022'
        }
      })
    }
  }

  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })