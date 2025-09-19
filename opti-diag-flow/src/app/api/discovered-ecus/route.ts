import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const oemId = searchParams.get('oemId')
    const modelId = searchParams.get('modelId')
    const modelYearId = searchParams.get('modelYearId')
    const protocol = searchParams.get('protocol')
    const confidence = searchParams.get('confidence')
    const search = searchParams.get('search')

    // Build where clause for hierarchy filtering
    const whereClause: any = {}

    if (oemId) {
      whereClause.DiagnosticJob = {
        Vehicle: {
          ModelYear: {
            Model: {
              oemId: oemId
            }
          }
        }
      }

    if (modelId) {
      whereClause.DiagnosticJob = {
        ...whereClause.DiagnosticJob,
        Vehicle: {
          ...whereClause.DiagnosticJob?.Vehicle,
          ModelYear: {
            ...whereClause.DiagnosticJob?.Vehicle?.ModelYear,
            Model: {
              ...whereClause.DiagnosticJob?.Vehicle?.ModelYear?.Model,
              id: modelId
            }
          }
        }
      }

    if (modelYearId) {
      whereClause.DiagnosticJob = {
        ...whereClause.DiagnosticJob,
        Vehicle: {
          ...whereClause.DiagnosticJob?.Vehicle,
          ModelYear: {
            ...whereClause.DiagnosticJob?.Vehicle?.ModelYear,
            id: modelYearId
          }
        }
      }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { ecuAddress: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } }
      ]

    // Add confidence filter
    if (confidence && confidence !== 'all') {
      whereClause.confidence = confidence

    // Using ODXDiscoveryResult model for discovered ECUs
    const discoveredEcus = await prisma.oDXDiscoveryResult.findMany({
      where: whereClause,
      include: {
        DiagnosticJob: {
          include: {
            Vehicle: {
              include: {
                ModelYear: {
                  include: {
                    Model: {
                      include: {
                        OEM: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform data for frontend
    const transformedEcus = discoveredEcus.map(ecu => ({
      id: ecu.id,
      address: ecu.ecuAddress,
      name: `ECU ${ecu.ecuAddress}`,
      type: ecu.type,
      confidence: ecu.confidence,
      discoveredAt: ecu.createdAt.toISOString(),
      lastSeen: ecu.updatedAt.toISOString(),
      description: ecu.description || '',
      technicalNotes: ecu.technicalNotes || '',
      vehicle: ecu.DiagnosticJob?.Vehicle ? {
        id: ecu.DiagnosticJob.Vehicle.id,
        vin: ecu.DiagnosticJob.Vehicle.vin,
        model: ecu.DiagnosticJob.Vehicle.ModelYear.Model.name,
        year: ecu.DiagnosticJob.Vehicle.ModelYear.year,
        oem: ecu.DiagnosticJob.Vehicle.ModelYear.Model.OEM.name,
        platform: ecu.DiagnosticJob.Vehicle.ModelYear.Model.platform
      } : null
    }))

    // Calculate stats
    const stats = {
      results: transformedEcus.length,
      highConfidence: transformedEcus.filter(e => e.confidence === 'HIGH' || e.confidence === 'CONFIRMED').length,
      mediumConfidence: transformedEcus.filter(e => e.confidence === 'MEDIUM').length,
      lowConfidence: transformedEcus.filter(e => e.confidence === 'LOW').length

    return NextResponse.json({
      ecus: transformedEcus,
      stats,
      total: transformedEcus.length
    })

  } catch (error) {
    console.error('Error fetching discovered ECUs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch discovered ECUs' },
      { status: 500 }
    )
  }
}