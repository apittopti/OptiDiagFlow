import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const oemId = searchParams.get('oemId')

    const where: any = {}
    if (oemId) {
      where.oemId = oemId
    }

    const models = await prisma.model.findMany({
      where,
      include: {
        OEM: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        _count: {
          select: {
            ModelYear: true
          }
        }
      },
      orderBy: [
        { OEM: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(models)
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, oemId, platform, code } = body

    if (!name || !oemId) {
      return NextResponse.json(
        { error: 'Model name and OEM ID are required' },
        { status: 400 }
      )
    }

    const oem = await prisma.oEM.findUnique({
      where: { id: oemId }
    })

    if (!oem) {
      return NextResponse.json(
        { error: 'OEM not found' },
        { status: 404 }
      )
    }

    const existingModel = await prisma.model.findFirst({
      where: {
        name,
        oemId
      }
    })

    if (existingModel) {
      return NextResponse.json(
        { error: 'Model with this name already exists for this OEM' },
        { status: 409 }
      )
    }

    // Generate a code if not provided
    const modelCode = code || `${oem.shortName || oem.name.toUpperCase()}_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`

    const model = await prisma.model.create({
      data: {
        name,
        oemId,
        platform,
        code: modelCode
      },
      include: {
        OEM: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        _count: {
          select: {
            ModelYear: true
          }
        }
      }
    })

    return NextResponse.json(model, { status: 201 })
  } catch (error) {
    console.error('Error creating model:', error)
    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    )
  }
}