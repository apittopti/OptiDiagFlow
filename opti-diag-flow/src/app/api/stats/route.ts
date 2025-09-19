import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get simple counts for dashboard
    const [
      totalJobs,
      activeJobs,
      totalVehicles
    ] = await Promise.all([
      prisma.diagnosticJob.count(),
      prisma.diagnosticJob.count({ where: { status: 'ACTIVE' } }),
      prisma.vehicle.count()
    ])

    return NextResponse.json({
      totalJobs,
      activeJobs,
      totalVehicles,
      ecuTypes: 0,
      diagServices: 0,
      standardDIDs: 0
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}