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
    const { ecuName, description } = body

    // Update the ECU mapping
    const updated = await prisma.eCUMapping.update({
      where: { id: params.id },
      data: {
        ...(ecuName !== undefined && { ecuName }),
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating ECU mapping:', error)
    return NextResponse.json(
      { error: 'Failed to update ECU mapping' },
      { status: 500 }
    )
  }
}