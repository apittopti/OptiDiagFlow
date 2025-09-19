import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, vehicleId, oemId, modelId, modelYearId } = body

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json(
        { error: 'Addresses array is required' },
        { status: 400 }
      )
    }

    const resolvedECUs: Record<string, any> = {}

    // Query the knowledge base for ECU definitions
    for (const address of addresses) {
      const upperAddr = address.toUpperCase()

      // Try to find ECU definition in knowledge base
      // Priority order: ModelYear specific > Model specific > OEM specific > Any
      let ecuDef = null

      // First try with full context (OEM, Model, ModelYear)
      if (modelYearId) {
        ecuDef = await prisma.eCUDefinition.findFirst({
          where: {
            address: upperAddr,
            modelYearId,
            isVerified: true
          },
          orderBy: { confidence: 'desc' }
        })
      }

      // If not found, try with Model context
      if (!ecuDef && modelId) {
        ecuDef = await prisma.eCUDefinition.findFirst({
          where: {
            address: upperAddr,
            modelId,
            isVerified: true
          },
          orderBy: { confidence: 'desc' }
        })
      }

      // If not found, try with OEM context
      if (!ecuDef && oemId) {
        ecuDef = await prisma.eCUDefinition.findFirst({
          where: {
            address: upperAddr,
            oemId,
            isVerified: true
          },
          orderBy: { confidence: 'desc' }
        })
      }

      // If still not found, try any verified definition for this address
      if (!ecuDef) {
        ecuDef = await prisma.eCUDefinition.findFirst({
          where: {
            address: upperAddr,
            isVerified: true
          },
          orderBy: { confidence: 'desc' }
        })
      }

      // Finally, try any definition (even unverified)
      if (!ecuDef) {
        ecuDef = await prisma.eCUDefinition.findFirst({
          where: {
            address: upperAddr
          },
          orderBy: [
            { isVerified: 'desc' },
            { confidence: 'desc' }
          ]
        })
      }

      // If found in knowledge base, use it
      if (ecuDef) {
        resolvedECUs[address] = {
          name: ecuDef.name,
          fullName: ecuDef.description || ecuDef.name,
          description: ecuDef.description || `ECU at address ${upperAddr}`,
          category: ecuDef.category,
          source: 'knowledge',
          confidence: ecuDef.confidence,
          isVerified: ecuDef.isVerified
        }
      } else {
        // Generate default name if not in knowledge base
        resolvedECUs[address] = generateDefaultECUName(upperAddr)
      }
    }

    return NextResponse.json(resolvedECUs)
  } catch (error) {
    console.error('Error resolving ECU names:', error)
    return NextResponse.json(
      { error: 'Failed to resolve ECU names' },
      { status: 500 }
    )
  }
}

// Generate default ECU name based on address patterns
function generateDefaultECUName(address: string): any {
  // Common ECU address patterns
  const patterns: Record<string, any> = {
    '0E80': { name: 'TESTER', fullName: 'Diagnostic Tester', category: 'Diagnostic' },
    '07DF': { name: 'BROADCAST', fullName: 'Broadcast Address', category: 'Network' },
    'FFFF': { name: 'GATEWAY', fullName: 'Gateway Module', category: 'Network' }
  }

  if (patterns[address]) {
    return {
      ...patterns[address],
      description: `Default name for ${address}`,
      source: 'default',
      confidence: 0.5,
      isVerified: false
    }
  }

  // Generate based on address range
  const addrNum = parseInt(address, 16)
  let category = 'Unknown'
  let prefix = 'ECU'

  if (addrNum >= 0x1700 && addrNum <= 0x17FF) {
    category = 'Powertrain'
    prefix = 'PCM'
  } else if (addrNum >= 0x1400 && addrNum <= 0x14FF) {
    category = 'Body'
    prefix = 'BCM'
  } else if (addrNum >= 0x1600 && addrNum <= 0x16FF) {
    category = 'Chassis'
    prefix = 'CHAS'
  } else if (addrNum >= 0x1800 && addrNum <= 0x18FF) {
    category = 'Safety'
    prefix = 'SAFE'
  }

  return {
    name: `${prefix}_${address}`,
    fullName: `${category} Module ${address}`,
    description: `Unknown ECU at address 0x${address}`,
    category,
    source: 'generated',
    confidence: 0.1,
    isVerified: false
  }
}