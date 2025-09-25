import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/model-years/[id] - Get a specific model year
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    const modelYear = await prisma.modelYear.findUnique({
      where: { id },
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
          select: {
            _count: {
              select: {
                DiagnosticJob: true
              }
            }
          }
        }
      }
    })

    if (!modelYear) {
      return NextResponse.json(
        { error: 'Model year not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(modelYear)
  } catch (error) {
    console.error('Error fetching model year:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model year' },
      { status: 500 }
    )
  }
}

// PUT /api/model-years/[id] - Update a model year
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params
    const body = await request.json()
    const { year, modelId } = body

    if (!year || !modelId) {
      return NextResponse.json(
        { error: 'Year and Model ID are required' },
        { status: 400 }
      )
    }

    // Validate year
    const currentYear = new Date().getFullYear()
    if (year < 1900 || year > currentYear + 2) {
      return NextResponse.json(
        { error: 'Invalid year range' },
        { status: 400 }
      )
    }

    // Check if model year exists
    const existingModelYear = await prisma.modelYear.findUnique({
      where: { id }
    })

    if (!existingModelYear) {
      return NextResponse.json(
        { error: 'Model year not found' },
        { status: 404 }
      )
    }

    // Verify model exists
    const model = await prisma.model.findUnique({
      where: { id: modelId }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Check for duplicate year within the same model (excluding current model year)
    const duplicateModelYear = await prisma.modelYear.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { year },
          { modelId }
        ]
      }
    })

    if (duplicateModelYear) {
      return NextResponse.json(
        { error: 'This year already exists for this model' },
        { status: 409 }
      )
    }

    const updatedModelYear = await prisma.modelYear.update({
      where: { id },
      data: {
        year,
        modelId
      },
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
          select: {
            _count: {
              select: {
                DiagnosticJob: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedModelYear)
  } catch (error) {
    console.error('Error updating model year:', error)
    return NextResponse.json(
      { error: 'Failed to update model year' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    // Check if model year exists and has related vehicles
    const modelYear = await prisma.modelYear.findUnique({
      where: { id },
      include: {
        Vehicle: {
          include: {
            _count: {
              select: {
                DiagnosticJob: true
              }
            }
          }
        }
      }
    })

    if (!modelYear) {
      return NextResponse.json(
        { error: 'Model year not found' },
        { status: 404 }
      )
    }

    // Check if any vehicles have jobs
    const totalJobs = modelYear.Vehicle.reduce((total, vehicle) => total + vehicle._count.DiagnosticJob, 0)

    if (totalJobs > 0) {
      return NextResponse.json(
        { error: 'Cannot delete model year with existing diagnostic jobs.' },
        { status: 409 }
      )
    }

    // Delete orphan vehicles (vehicles without jobs) associated with this model year
    // This handles cases where jobs were deleted but vehicles remained
    const orphanVehicles = modelYear.Vehicle.filter(vehicle => vehicle._count.DiagnosticJob === 0)

    if (orphanVehicles.length > 0) {
      await prisma.vehicle.deleteMany({
        where: {
          id: {
            in: orphanVehicles.map(v => v.id)
          }
        }
      })
    }

    // Now delete the model year
    await prisma.modelYear.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: 'Model year deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting model year:', error)
    return NextResponse.json(
      { error: 'Failed to delete model year' },
      { status: 500 }
    )
  }
}