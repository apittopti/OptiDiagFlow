import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const modelId = searchParams.get('modelId')

    const where: any = {}
    if (modelId) {
      where.modelId = modelId
    }

    const modelYears = await prisma.modelYear.findMany({
      where,
      include: {
        Model: {
          include: {
            OEM: {
              select: {
                id: true,
                name: true,
                shortName: true
              }
            }
          }
        }
      },
      orderBy: [
        { Model: { OEM: { name: 'asc' } } },
        { Model: { name: 'asc' } },
        { year: 'desc' }
      ]
    })

    return NextResponse.json(modelYears)
  } catch (error) {
    console.error('Error fetching model years:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model years' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, modelId } = body

    if (!year || !modelId) {
      return NextResponse.json(
        { error: 'Year and Model ID are required' },
        { status: 400 }
      )
    }

    const modelYear = await prisma.modelYear.create({
      data: {
        year,
        modelId
      },
      include: {
        Model: {
          include: {
            OEM: true
          }
        }
      }
    })

    return NextResponse.json(modelYear, { status: 201 })
  } catch (error) {
    console.error('Error creating model year:', error)
    return NextResponse.json(
      { error: 'Failed to create model year' },
      { status: 500 }
    )
  }
}