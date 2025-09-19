import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const [ecuCount, didCount, dtcCount, routineCount] = await Promise.all([
      prisma.eCUDefinition.count(),
      prisma.dIDDefinition.count(),
      prisma.dTCDefinition.count(),
      prisma.routineDefinition.count()
    ])

    return NextResponse.json({
      ecuCount,
      didCount,
      dtcCount,
      routineCount
    })
  } catch (error) {
    console.error('Error fetching knowledge stats:', error)
    return NextResponse.json({
      ecuCount: 0,
      didCount: 0,
      dtcCount: 0,
      routineCount: 0
    })
  }
}