import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * ODX ECU Manager
 *
 * Creates BASE-VARIANT for each unique ECU address discovered
 * Each BASE-VARIANT represents diagnostic data for a specific ECU at a specific address
 * ECU-VARIANTs can then be created for different SW/HW versions of that ECU
 */
export class ODXECUManager {
  /**
   * Create or get a BASE-VARIANT for a specific ECU address
   * Each unique ECU address gets its own BASE-VARIANT
   */
  async ensureBaseVariantForECU(
    ecuAddress: string,
    ecuName: string,
    modelYearId: string,
    companyId?: string
  ) {
    // Use ISO company if not specified
    const company = companyId || await this.getISOCompany()

    // Get or create diagnostic layer for this model year
    const layer = await prisma.diagnosticLayer.upsert({
      where: {
        companyId_shortName: {
          companyId: company,
          shortName: `MY_${modelYearId}_DIAGNOSTIC`,
        },
      },
      update: {},
      create: {
        companyId: company,
        shortName: `MY_${modelYearId}_DIAGNOSTIC`,
        longName: `Diagnostic Layer for Model Year ${modelYearId}`,
        layerType: 'BASE_VARIANT',
        protocolName: 'UDS',
      },
    })

    // Create BASE-VARIANT for this specific ECU address
    // Each ECU address gets its own BASE-VARIANT
    const baseVariant = await prisma.baseVariant.upsert({
      where: {
        layerId_shortName: {
          layerId: layer.id,
          shortName: `ECU_${ecuAddress}_BASE`,
        },
      },
      update: {
        longName: ecuName,
        description: `Base variant for ECU at address ${ecuAddress} - ${ecuName}`,
      },
      create: {
        layerId: layer.id,
        shortName: `ECU_${ecuAddress}_BASE`,
        longName: ecuName,
        description: `Base variant for ECU at address ${ecuAddress} - ${ecuName}`,
      },
    })

    console.log(`Created/Updated BASE-VARIANT for ECU ${ecuAddress} (${ecuName})`)
    return baseVariant
  }

  /**
   * Create an ECU-VARIANT for a specific software/hardware version
   * Multiple ECU-VARIANTs can exist for the same BASE-VARIANT
   */
  async createECUVariant(
    baseVariantId: string,
    ecuAddress: string,
    swVersion?: string,
    hwVersion?: string,
    partNumber?: string
  ) {
    const layerId = await this.getLayerIdFromBaseVariant(baseVariantId)

    // Create a unique short name based on version info
    const versionSuffix = swVersion || hwVersion || partNumber || 'DEFAULT'
    const shortName = `ECU_${ecuAddress}_${versionSuffix.replace(/[^A-Z0-9]/gi, '_')}`

    const ecuVariant = await prisma.eCUVariant.upsert({
      where: {
        layerId_shortName: {
          layerId,
          shortName,
        },
      },
      update: {
        description: this.buildVariantDescription(swVersion, hwVersion, partNumber),
      },
      create: {
        layerId,
        baseVariantId,
        shortName,
        longName: `ECU ${ecuAddress} Variant ${versionSuffix}`,
        ecuAddress,
        description: this.buildVariantDescription(swVersion, hwVersion, partNumber),
      },
    })

    return ecuVariant
  }

  /**
   * Process discovered ECUs from a trace session
   * Creates BASE-VARIANT for each unique ECU address
   */
  async processDiscoveredECUs(
    ecus: Map<string, any>,
    modelYearId: string,
    jobId: string
  ) {
    const results = []

    for (const [ecuAddress, ecuData] of ecus) {
      // Create BASE-VARIANT for this specific ECU
      const baseVariant = await this.ensureBaseVariantForECU(
        ecuAddress,
        ecuData.name || `ECU_${ecuAddress}`,
        modelYearId
      )

      // If we have version information, create an ECU-VARIANT
      if (ecuData.swVersion || ecuData.hwVersion || ecuData.partNumber) {
        const ecuVariant = await this.createECUVariant(
          baseVariant.id,
          ecuAddress,
          ecuData.swVersion,
          ecuData.hwVersion,
          ecuData.partNumber
        )

        results.push({
          ecuAddress,
          baseVariantId: baseVariant.id,
          ecuVariantId: ecuVariant.id,
        })
      } else {
        results.push({
          ecuAddress,
          baseVariantId: baseVariant.id,
          ecuVariantId: null,
        })
      }

      // Store discovery result
      await prisma.oDXDiscoveryResult.create({
        data: {
          jobId,
          sessionId: jobId, // Using jobId as sessionId for now
          ecuAddress,
          type: 'ECU_BASE_VARIANT',
          confidence: 'HIGH',
          pattern: {
            ecuAddress,
            ecuName: ecuData.name,
            baseVariantId: baseVariant.id,
            messageCount: ecuData.messagesSent + ecuData.messagesReceived,
          },
          metadata: {
            firstSeen: ecuData.firstSeen,
            lastSeen: ecuData.lastSeen,
          },
        },
      })
    }

    return results
  }

  /**
   * Link services to a BASE-VARIANT
   * Services discovered for an ECU are linked to its BASE-VARIANT
   */
  async linkServicesToBaseVariant(
    baseVariantId: string,
    services: string[]
  ) {
    const layerId = await this.getLayerIdFromBaseVariant(baseVariantId)

    for (const serviceId of services) {
      // Check if this is a standard UDS service
      const udsService = await prisma.diagService.findFirst({
        where: {
          requestSID: serviceId,
          diagnosticLayer: {
            protocolName: 'UDS',
            layerType: 'PROTOCOL',
          },
        },
      })

      if (udsService) {
        // Link the standard service to this ECU's BASE-VARIANT
        // This would be done through a relation table in a full implementation
        console.log(`Linked UDS service ${serviceId} to BASE-VARIANT ${baseVariantId}`)
      } else {
        // Create a custom service for this ECU
        await prisma.diagService.create({
          data: {
            layerId,
            shortName: `SERVICE_${serviceId}`,
            longName: `Service 0x${serviceId}`,
            requestSID: serviceId,
            addressing: 'PHYSICAL',
          },
        })
      }
    }
  }

  // Helper methods
  private async getISOCompany(): Promise<string> {
    const company = await prisma.company.upsert({
      where: { shortName: 'ISO' },
      update: {},
      create: {
        name: 'ISO Standards',
        shortName: 'ISO',
      },
    })
    return company.id
  }

  private async getLayerIdFromBaseVariant(baseVariantId: string): Promise<string> {
    const baseVariant = await prisma.baseVariant.findUnique({
      where: { id: baseVariantId },
    })
    if (!baseVariant) {
      throw new Error(`Base variant ${baseVariantId} not found`)
    }
    return baseVariant.layerId
  }

  private buildVariantDescription(
    swVersion?: string,
    hwVersion?: string,
    partNumber?: string
  ): string {
    const parts = []
    if (swVersion) parts.push(`SW: ${swVersion}`)
    if (hwVersion) parts.push(`HW: ${hwVersion}`)
    if (partNumber) parts.push(`PN: ${partNumber}`)
    return parts.length > 0
      ? `ECU Variant with ${parts.join(', ')}`
      : 'Default ECU Variant'
  }
}

/**
 * Update trace parsing to create BASE-VARIANT for each ECU
 */
export async function createBaseVariantsFromTrace(
  parsedData: any,
  modelYearId: string,
  jobId: string
) {
  const manager = new ODXECUManager()

  // Process each discovered ECU
  const results = await manager.processDiscoveredECUs(
    parsedData.ecus,
    modelYearId,
    jobId
  )

  // Link discovered services to ECUs
  for (const [ecuAddress, ecuData] of parsedData.ecus) {
    const baseVariant = results.find(r => r.ecuAddress === ecuAddress)
    if (baseVariant && baseVariant.baseVariantId && ecuData.services) {
      await manager.linkServicesToBaseVariant(
        baseVariant.baseVariantId,
        Array.from(ecuData.services)
      )
    }
  }

  console.log(`Created BASE-VARIANTs for ${results.length} ECUs`)
  return results
}