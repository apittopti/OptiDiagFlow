import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/models/[id] - Get a specific model
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    const model = await prisma.model.findUnique({
      where: { id },
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

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(model)
  } catch (error) {
    console.error('Error fetching model:', error)
    return NextResponse.json(
      { error: 'Failed to fetch model' },
      { status: 500 }
    )
  }
}

// PUT /api/models/[id] - Update a model
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params
    const body = await request.json()
    const { name, oemId, platform } = body

    if (!name || !oemId) {
      return NextResponse.json(
        { error: 'Model name and OEM ID are required' },
        { status: 400 }
      )
    }

    // Check if model exists
    const existingModel = await prisma.model.findUnique({
      where: { id }
    })

    if (!existingModel) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Verify OEM exists
    const oem = await prisma.oEM.findUnique({
      where: { id: oemId }
    })

    if (!oem) {
      return NextResponse.json(
        { error: 'OEM not found' },
        { status: 404 }
      )
    }

    // Check for duplicate model name within the same OEM (excluding current model)
    const duplicateModel = await prisma.model.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          { name },
          { oemId }
        ]
      }
    })

    if (duplicateModel) {
      return NextResponse.json(
        { error: 'Model with this name already exists for this OEM' },
        { status: 409 }
      )
    }

    const updatedModel = await prisma.model.update({
      where: { id },
      data: {
        name,
        oemId,
        platform
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

    return NextResponse.json(updatedModel)
  } catch (error) {
    console.error('Error updating model:', error)
    return NextResponse.json(
      { error: 'Failed to update model' },
      { status: 500 }
    )
  }
}

// DELETE /api/models/[id] - Delete a model
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    // Check if model exists and has related model years
    const model = await prisma.model.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ModelYear: true
          }
        }
      }
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    if (model._count.ModelYear > 0) {
      return NextResponse.json(
        { error: 'Cannot delete model with existing years. Delete all years first.' },
        { status: 409 }
      )
    }

    // Delete the model
    await prisma.model.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: 'Model deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting model:', error)
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    )
  }
}