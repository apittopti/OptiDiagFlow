import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // AUTH DISABLED

    // Fetch OEMs with their simplified structure
    const oems = await prisma.oEM.findMany({
      include: {
        Model: {
          include: {
            ModelYear: {
              include: {
                Vehicle: {
                  include: {
                    _count: {
                      select: {
                        DiagnosticJob: true
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
        name: 'asc'
      }
    })

    // Transform data for simplified ODX structure
    const transformedOems = oems.map(oem => ({
      id: oem.id,
      name: oem.name,
      shortName: oem.shortName,
      models: oem.Model.map(model => ({
        id: model.id,
        name: model.name,
        platform: model.platform,
        modelYears: model.ModelYear.map(year => ({
          id: year.id,
          year: year.year,
          vehicleCount: year.Vehicle.length,
          totalJobs: year.Vehicle.reduce((sum, v) => sum + v._count.DiagnosticJob, 0),
          // Simplified structure without complex ODX relationships
          ecuMappings: [] // Empty for now since ODX tables don't exist
        }))
      }))
    }))

    return NextResponse.json({
      success: true,
      oems: transformedOems
    })
  } catch (error) {
    console.error('Error fetching ODX hierarchy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ODX hierarchy' },
      { status: 500 }
    )
  }
}