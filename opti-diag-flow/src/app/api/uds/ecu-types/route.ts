import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const ecuTypes = await prisma.eCUType.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            serviceMappings: true,
            ecuProfiles: true
          }
        }
      }
    })

    return NextResponse.json(ecuTypes)
  } catch (error) {
    console.error('Error fetching ECU types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ECU types' },
      { status: 500 }
    )
  }
}