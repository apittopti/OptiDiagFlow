import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // AUTH DISABLED

    // Fetch all trace sessions with job and vehicle information
    const traceSessions = await prisma.traceSession.findMany({
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
      },
      take: 50 // Limit to recent 50 sessions
    })

    // Transform data for frontend consumption
    const transformedSessions = traceSessions.map(session => ({
      id: session.id,
      name: session.fileName || 'Unnamed Session',
      createdAt: session.createdAt.toISOString(),
      job: session.DiagnosticJob ? {
        id: session.DiagnosticJob.id,
        name: session.DiagnosticJob.name,
        vehicle: {
          id: session.DiagnosticJob.Vehicle.id,
          vin: session.DiagnosticJob.Vehicle.vin,
          modelYear: {
            id: session.DiagnosticJob.Vehicle.ModelYear.id,
            year: session.DiagnosticJob.Vehicle.ModelYear.year,
            model: {
              id: session.DiagnosticJob.Vehicle.ModelYear.Model.id,
              name: session.DiagnosticJob.Vehicle.ModelYear.Model.name,
              oem: {
                id: session.DiagnosticJob.Vehicle.ModelYear.Model.OEM.id,
                name: session.DiagnosticJob.Vehicle.ModelYear.Model.OEM.name,
                shortName: session.DiagnosticJob.Vehicle.ModelYear.Model.OEM.shortName
              }
            }
          }
        }
      } : null
    }))

    return NextResponse.json({
      success: true,
      sessions: transformedSessions
    })
  } catch (error) {
    console.error('Error fetching trace sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trace sessions' },
      { status: 500 }
    )
  }
}