import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/oems/[id] - Get a specific OEM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    const oem = await prisma.oEM.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Model: true
          }
        }
      }
    })

    if (!oem) {
      return NextResponse.json(
        { error: 'OEM not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(oem)
  } catch (error) {
    console.error('Error fetching OEM:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OEM' },
      { status: 500 }
    )
  }
}

// PUT /api/oems/[id] - Update an OEM
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params
    const body = await request.json()
    const { name, shortName } = body

    if (!name) {
      return NextResponse.json(
        { error: 'OEM name is required' },
        { status: 400 }
      )
    }

    // Check if OEM exists
    const existingOEM = await prisma.oEM.findUnique({
      where: { id }
    })

    if (!existingOEM) {
      return NextResponse.json(
        { error: 'OEM not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name (excluding current OEM)
    const duplicateOEM = await prisma.oEM.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [
              { name },
              { shortName: shortName || undefined }
            ]
          }
        ]
      }
    })

    if (duplicateOEM) {
      return NextResponse.json(
        { error: 'OEM with this name or short name already exists' },
        { status: 409 }
      )
    }

    const updatedOEM = await prisma.oEM.update({
      where: { id },
      data: {
        name,
        shortName: shortName || name
      },
      include: {
        _count: {
          select: {
            Model: true
          }
        }
      }
    })

    return NextResponse.json(updatedOEM)
  } catch (error) {
    console.error('Error updating OEM:', error)
    return NextResponse.json(
      { error: 'Failed to update OEM' },
      { status: 500 }
    )
  }
}

// DELETE /api/oems/[id] - Delete an OEM
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED

    const { id } = await params

    // Check if OEM exists and has related models
    const oem = await prisma.oEM.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Model: true
          }
        }
      }
    })

    if (!oem) {
      return NextResponse.json(
        { error: 'OEM not found' },
        { status: 404 }
      )
    }

    if (oem._count.Model > 0) {
      return NextResponse.json(
        { error: 'Cannot delete OEM with existing models. Delete all models first.' },
        { status: 409 }
      )
    }

    // Delete the OEM
    await prisma.oEM.delete({
      where: { id }
    })

    return NextResponse.json(
      { message: 'OEM deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting OEM:', error)
    return NextResponse.json(
      { error: 'Failed to delete OEM' },
      { status: 500 }
    )
  }
}