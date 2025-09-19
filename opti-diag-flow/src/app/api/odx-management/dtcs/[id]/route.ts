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
    const { description } = body

    // Update the DTC DOP in ODX structure
    const updated = await prisma.dTCDOP.update({
      where: { id: params.id },
      data: {
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating DTC:', error)
    return NextResponse.json(
      { error: 'Failed to update DTC' },
      { status: 500 }
    )
  }
}