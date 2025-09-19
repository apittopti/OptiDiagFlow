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
    const { name, description } = body

    // Update the DataObjectProp in ODX structure
    const updated = await prisma.dataObjectProp.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { longName: name }),
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating DID:', error)
    return NextResponse.json(
      { error: 'Failed to update DID' },
      { status: 500 }
    )
  }
}