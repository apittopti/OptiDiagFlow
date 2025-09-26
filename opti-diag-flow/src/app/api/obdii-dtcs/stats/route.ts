import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get total counts for all OBD-II DTCs (no filters)
    const [total, generic, manufacturer] = await Promise.all([
      prisma.oBDIIDTCDefinition.count(),
      prisma.oBDIIDTCDefinition.count({
        where: { isGeneric: true }
      }),
      prisma.oBDIIDTCDefinition.count({
        where: { isGeneric: false }
      })
    ])

    // Get counts by system
    const systemCounts = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['system'],
      _count: true
    })

    // Get counts by category (top categories)
    const categoryCounts = await prisma.oBDIIDTCDefinition.groupBy({
      by: ['category'],
      _count: true,
      orderBy: {
        _count: {
          category: 'desc'
        }
      },
      take: 10
    })

    return NextResponse.json({
      total,
      generic,
      manufacturer,
      systems: systemCounts.map(s => ({
        system: s.system,
        count: s._count
      })),
      topCategories: categoryCounts.map(c => ({
        category: c.category || 'Uncategorized',
        count: c._count
      }))
    })
  } catch (error) {
    console.error('Error fetching OBD-II stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OBD-II statistics' },
      { status: 500 }
    )
  }
}