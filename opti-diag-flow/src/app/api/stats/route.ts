import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get comprehensive counts for dashboard
    const [
      totalJobs,
      activeJobs,
      totalVehicles,
      discoveredECUs,
      totalDTCs,
      totalDIDs
    ] = await Promise.all([
      prisma.diagnosticJob.count(),
      prisma.diagnosticJob.count({ where: { status: 'ACTIVE' } }),
      prisma.vehicle.count(),
      prisma.eCUConfiguration.count(), // Count discovered ECUs from jobs
      prisma.dTC.count(), // Count total DTCs found
      prisma.dataIdentifier.count() // Count discovered DIDs from jobs
    ])

    return NextResponse.json({
      totalJobs,
      activeJobs,
      totalVehicles,
      discoveredECUs,
      totalDTCs,
      totalDIDs
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}