import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface VehicleStructure {
  oem: string
  models: {
    name: string
    years: number[]
  }[]
}

async function seedOEMs() {
  console.log('Starting OEM seeding process...')

  const traceLogsPath = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete'

  if (!fs.existsSync(traceLogsPath)) {
    console.error(`Trace logs directory not found: ${traceLogsPath}`)
    process.exit(1)
  }

  // Parse directory structure to build vehicle data
  const vehicles: VehicleStructure[] = []

  // Read OEM directories
  const oemDirs = fs.readdirSync(traceLogsPath)
    .filter(dir => fs.statSync(path.join(traceLogsPath, dir)).isDirectory())

  for (const oemDir of oemDirs) {
    const oemPath = path.join(traceLogsPath, oemDir)
    const oemName = oemDir === 'Landrover' ? 'Land Rover' : oemDir

    const vehicleStructure: VehicleStructure = {
      oem: oemName,
      models: []
    }

    // Read model directories
    const modelDirs = fs.readdirSync(oemPath)
      .filter(dir => fs.statSync(path.join(oemPath, dir)).isDirectory())

    for (const modelDir of modelDirs) {
      const modelPath = path.join(oemPath, modelDir)
      const modelName = modelDir

      // Read year directories
      const yearDirs = fs.readdirSync(modelPath)
        .filter(dir => fs.statSync(path.join(modelPath, dir)).isDirectory())
        .map(dir => parseInt(dir))
        .filter(year => !isNaN(year))

      if (yearDirs.length > 0) {
        // Check if model already exists
        const existingModel = vehicleStructure.models.find(m => m.name === modelName)
        if (existingModel) {
          existingModel.years.push(...yearDirs)
        } else {
          vehicleStructure.models.push({
            name: modelName,
            years: yearDirs
          })
        }
      }
    }

    if (vehicleStructure.models.length > 0) {
      vehicles.push(vehicleStructure)
    }
  }

  console.log(`Found ${vehicles.length} OEMs with vehicles`)

  // Now seed the database
  for (const vehicle of vehicles) {
    console.log(`\nProcessing OEM: ${vehicle.oem}`)

    // Create or update the OEM
    const oem = await prisma.oEM.upsert({
      where: { name: vehicle.oem },
      update: {},
      create: {
        name: vehicle.oem,
        shortName: vehicle.oem.toUpperCase().replace(/\s+/g, '_')
      }
    })

    console.log(`  Created/Updated OEM: ${oem.name} (ID: ${oem.id})`)

    // Create models and years
    for (const model of vehicle.models) {
      console.log(`  Processing Model: ${model.name}`)

      // Create or update the vehicle model
      const vehicleModel = await prisma.model.upsert({
        where: {
          oemId_name: {
            oemId: oem.id,
            name: model.name
          }
        },
        update: {},
        create: {
          oemId: oem.id,
          name: model.name,
          code: `${oem.shortName}_${model.name.toUpperCase().replace(/\s+/g, '_')}`,
          description: `${oem.name} ${model.name}`
        }
      })

      console.log(`    Created/Updated Model: ${vehicleModel.name} (ID: ${vehicleModel.id})`)

      // Create model years
      for (const year of model.years) {
        const modelYear = await prisma.modelYear.upsert({
          where: {
            modelId_year: {
              modelId: vehicleModel.id,
              year: year
            }
          },
          update: {},
          create: {
            modelId: vehicleModel.id,
            year: year,
            code: `${oem.shortName}_${model.name.toUpperCase().replace(/\s+/g, '_')}_${year}`,
            description: `${oem.name} ${model.name} ${year}`
          }
        })

        console.log(`      Created/Updated Year: ${year} (ID: ${modelYear.id})`)
      }
    }
  }

  // Add summary
  const totalOEMs = await prisma.oEM.count()
  const totalModels = await prisma.model.count()
  const totalModelYears = await prisma.modelYear.count()

  console.log('\n========================================')
  console.log('Seeding Complete!')
  console.log(`Total OEMs: ${totalOEMs}`)
  console.log(`Total Models: ${totalModels}`)
  console.log(`Total Model Years: ${totalModelYears}`)
  console.log('========================================')
}

// Run the seed
seedOEMs()
  .then(async () => {
    await prisma.$disconnect()
    console.log('\nDatabase connection closed.')
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })