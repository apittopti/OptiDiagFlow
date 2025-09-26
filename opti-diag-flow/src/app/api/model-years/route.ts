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
        },
        Vehicle: {
          include: {
            _count: {
              select: { DiagnosticJob: true }
            }
          }
        },
        _count: {
          select: { Vehicle: true }
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
    const { year, modelId, code, description } = body

    if (!year || !modelId) {
      return NextResponse.json(
        { error: 'Year and Model ID are required' },
        { status: 400 }
      )
    }

    // Get the model to generate a proper code
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: { OEM: true }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Generate a code if not provided
    const modelYearCode = code || `${model.code}_${year}`

    const modelYear = await prisma.modelYear.create({
      data: {
        year,
        modelId,
        code: modelYearCode,
        description: description || `${model.OEM.name} ${model.name} ${year}`
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