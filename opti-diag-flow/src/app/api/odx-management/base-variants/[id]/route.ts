import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED

    const body = await request.json()
    const { longName, description } = body

    // Update the BaseVariant in ODX structure
    const updated = await prisma.baseVariant.update({
      where: { id: params.id },
      data: {
        ...(longName !== undefined && { longName }),
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating BaseVariant:', error)
    return NextResponse.json(
      { error: 'Failed to update BaseVariant' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED

    const baseVariant = await prisma.baseVariant.findUnique({
      where: { id: params.id },
      include: {
        layer: {
          include: {
            company: true
          }
        }
      }
    })

    if (!baseVariant) {
      return NextResponse.json(
        { error: 'BaseVariant not found' },
        { status: 404 }
      )

    return NextResponse.json({
      success: true,
      data: baseVariant
    })
  } catch (error) {
    console.error('Error fetching BaseVariant:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BaseVariant' },
      { status: 500 }
    )
  }
}