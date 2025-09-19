import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Simplified ODX Manager
 *
 * - Creates one BASE-VARIANT per ECU address per Model
 * - ECU-VARIANTs can optionally override for specific ModelYears
 * - Focus on building knowledge, not complex variant hierarchies
 */
export class SimplifiedODXManager {
  /**
   * Get or create a BASE-VARIANT for an ECU at the Model level
   * This represents the diagnostic data for this ECU type across all years of this model
   */
  async ensureBaseVariantForECU(
    ecuAddress: string,
    ecuName: string,
    modelId: string
  ) {
    // Get model information
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: { oem: true }
    })

    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    // Ensure Company record exists for this OEM
    const company = await prisma.company.upsert({
      where: {
        shortName: model.oem.shortName,
      },
      update: {
        name: model.oem.name,
      },
      create: {
        shortName: model.oem.shortName,
        name: model.oem.name,
      },
    })

    // Get or create diagnostic layer for this OEM/Model
    const layer = await prisma.diagnosticLayer.upsert({
      where: {
        companyId_shortName: {
          companyId: company.id,
          shortName: `${model.oem.shortName}_${model.name.replace(/\s+/g, '_')}_DIAG`,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        shortName: `${model.oem.shortName}_${model.name.replace(/\s+/g, '_')}_DIAG`,
        longName: `${model.oem.name} ${model.name} Diagnostic Layer`,
        layerType: 'BASE_VARIANT',
        protocolName: 'UDS',
      },
    })

    // Create BASE-VARIANT for this ECU at this address
    // One per ECU address per Model
    const baseVariant = await prisma.baseVariant.upsert({
      where: {
        layerId_shortName: {
          layerId: layer.id,
          shortName: `ECU_${ecuAddress}`,
        },
      },
      update: {
        longName: ecuName,
        description: `${ecuName} at address 0x${ecuAddress} for ${model.oem.name} ${model.name}`,
      },
      create: {
        layerId: layer.id,
        shortName: `ECU_${ecuAddress}`,
        longName: ecuName,
        description: `${ecuName} at address 0x${ecuAddress} for ${model.oem.name} ${model.name}`,
      },
    })

    console.log(`Created/Updated BASE-VARIANT for ECU 0x${ecuAddress} (${ecuName}) on ${model.name}`)
    return baseVariant
  }

  /**
   * Process ECUs discovered in a trace file
   * Creates BASE-VARIANTs at the Model level
   */
  async processDiscoveredECUs(
    ecus: Map<string, any>,
    vehicleId: string,
    jobId: string,
    sessionId: string
  ) {
    // Get vehicle with full hierarchy
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        modelYear: {
          include: {
            model: {
              include: {
                oem: true
              }
            }
          }
        }
      }
    })

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`)
    }

    const modelId = vehicle.modelYear.modelId
    const results = []

    for (const [ecuAddress, ecuData] of ecus) {
      // Create BASE-VARIANT at Model level
      const baseVariant = await this.ensureBaseVariantForECU(
        ecuAddress,
        ecuData.name || `ECU_${ecuAddress}`,
        modelId
      )

      results.push({
        ecuAddress,
        ecuName: ecuData.name,
        baseVariantId: baseVariant.id,
        modelId,
      })

      // Store discovery result
      await prisma.oDXDiscoveryResult.create({
        data: {
          jobId,
          sessionId,
          ecuAddress,
          type: 'ECU_DISCOVERED',
          confidence: 'HIGH',
          pattern: {
            ecuAddress,
            ecuName: ecuData.name,
            baseVariantId: baseVariant.id,
            modelId,
            messageStats: {
              sent: ecuData.messagesSent,
              received: ecuData.messagesReceived,
            }
          },
          metadata: {
            firstSeen: ecuData.firstSeen,
            lastSeen: ecuData.lastSeen,
            vehicleId,
            modelYear: vehicle.modelYear.year,
          },
          isConfirmed: false,
        },
      })

      // If this ECU has services, store them
      if (ecuData.services && ecuData.services.size > 0) {
        const services = Array.from(ecuData.services)
        await this.storeECUServices(baseVariant.id, ecuAddress, services, jobId)
      }

      // If this ECU has DTCs, store them
      if (ecuData.dtcs && ecuData.dtcs.length > 0) {
        await this.storeECUDTCs(baseVariant.layerId, ecuAddress, ecuData.dtcs, jobId)
      }
    }

    return results
  }

  /**
   * Store services discovered for an ECU
   */
  async storeECUServices(
    baseVariantId: string,
    ecuAddress: string,
    services: string[],
    jobId: string
  ) {
    for (const serviceId of services) {
      await prisma.oDXDiscoveryResult.create({
        data: {
          jobId,
          sessionId,
          ecuAddress,
          type: 'SERVICE',
          confidence: 'MEDIUM',
          pattern: {
            serviceId,
            ecuAddress,
            baseVariantId,
          },
          metadata: {
            description: `Service 0x${serviceId} discovered on ECU 0x${ecuAddress}`,
          },
          isConfirmed: false,
        },
      })
    }
  }

  /**
   * Store DTCs discovered for an ECU
   */
  async storeECUDTCs(
    layerId: string,
    ecuAddress: string,
    dtcs: any[],
    jobId: string
  ) {
    for (const dtc of dtcs) {
      // Create or update DTC in DTCDOP table
      const dtcDop = await prisma.dTCDOP.upsert({
        where: {
          layerId_dtcNumber: {
            layerId,
            dtcNumber: dtc.code,
          },
        },
        update: {
          description: dtc.description || `DTC ${dtc.code}`,
        },
        create: {
          layerId,
          dtcNumber: dtc.code,
          shortName: `DTC_${dtc.code}`,
          longName: dtc.description || `Diagnostic Trouble Code ${dtc.code}`,
          troubleCode: dtc.code,
          displayCode: dtc.code,
          isVisible: true,
        },
      })

      // Store discovery result
      await prisma.oDXDiscoveryResult.create({
        data: {
          jobId,
          sessionId,
          ecuAddress,
          type: 'DTC',
          confidence: 'HIGH',
          pattern: {
            dtcCode: dtc.code,
            dtcStatus: dtc.status,
            ecuAddress,
            dtcDopId: dtcDop.id,
          },
          metadata: {
            description: `DTC ${dtc.code} discovered on ECU 0x${ecuAddress}`,
            status: dtc.status,
          },
          isConfirmed: false,
        },
      })
    }
  }

  /**
   * Create ModelYear-specific overrides if needed
   * This would be used when a specific ModelYear has different behavior
   */
  async createModelYearOverride(
    baseVariantId: string,
    modelYearId: string,
    overrideData: any
  ) {
    const baseVariant = await prisma.baseVariant.findUnique({
      where: { id: baseVariantId },
    })

    if (!baseVariant) {
      throw new Error(`Base variant ${baseVariantId} not found`)
    }

    // Create an ECU-VARIANT as an override for this specific ModelYear
    const ecuVariant = await prisma.eCUVariant.create({
      data: {
        layerId: baseVariant.layerId,
        baseVariantId,
        shortName: `${baseVariant.shortName}_MY_${modelYearId}`,
        longName: `${baseVariant.longName} - ModelYear Override`,
        ecuAddress: baseVariant.shortName.replace('ECU_', ''),
        description: `ModelYear-specific override for ${baseVariant.longName}`,
      },
    })

    console.log(`Created ModelYear override for ${baseVariant.shortName}`)
    return ecuVariant
  }
}

/**
 * Simple function to process trace and create BASE-VARIANTs
 */
export async function createBaseVariantsFromTrace(
  parsedData: any,
  vehicleId: string,
  jobId: string,
  sessionId: string
) {
  const manager = new SimplifiedODXManager()

  const results = await manager.processDiscoveredECUs(
    parsedData.ecus,
    vehicleId,
    jobId,
    sessionId
  )

  console.log(`Created/Updated BASE-VARIANTs for ${results.length} ECUs`)
  return results
}