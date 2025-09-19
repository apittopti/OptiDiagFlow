import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/vehicles - Get all vehicles or search
export async function GET(request: NextRequest) {
  try {
    // AUTH DISABLED


    const searchParams = request.nextUrl.searchParams
    const modelYearId = searchParams.get('modelYearId')
    const vin = searchParams.get('vin')

    const where: any = {}

    if (modelYearId) where.modelYearId = modelYearId
    if (vin) where.vin = { contains: vin, mode: 'insensitive' }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        ModelYear: {
          include: {
            Model: {
              include: {
                OEM: true
              }
            }
          }
        },
        _count: {
          select: {
            DiagnosticJob: true
          }
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(vehicles)
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    )
  }
}

// POST /api/vehicles - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    // AUTH DISABLED


    const body = await request.json()
    const { modelYearId, vin } = body

    // Validation
    if (!modelYearId) {
      return NextResponse.json(
        { error: 'Model year ID is required' },
        { status: 400 }
      )

    // Verify model year exists
    const modelYear = await prisma.modelYear.findUnique({
      where: { id: modelYearId }
    })

    if (!modelYear) {
      return NextResponse.json(
        { error: 'Invalid model year' },
        { status: 404 }
      )

    // Check for duplicate VIN if provided
    if (vin) {
      const vinExists = await prisma.vehicle.findUnique({
        where: { vin }
      })

      if (vinExists) {
        return NextResponse.json(
          { error: 'VIN already registered' },
          { status: 409 }
        )
      }

    const vehicle = await prisma.vehicle.create({
      data: {
        modelYearId,
        vin,
        createdBy: session.user.id
      },
      include: {
        ModelYear: {
          include: {
            Model: {
              include: {
                OEM: true
              }
            }
          }
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return NextResponse.json(
      { error: 'Failed to create vehicle' },
      { status: 500 }
    )
  }
}