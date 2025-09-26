import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dtc = await prisma.oBDIIDTCDefinition.findUnique({
      where: { id: params.id }
    })

    if (!dtc) {
      return NextResponse.json(
        { error: 'OBD-II DTC not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dtc)
  } catch (error) {
    console.error('Error fetching OBD-II DTC:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OBD-II DTC' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      system,
      category,
      isGeneric,
      symptoms,
      causes,
      diagnosticSteps,
      repairActions
    } = body

    const dtc = await prisma.oBDIIDTCDefinition.update({
      where: { id: params.id },
      data: {
        name,
        description,
        system,
        category,
        isGeneric,
        symptoms,
        causes,
        diagnosticSteps,
        repairActions,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(dtc)
  } catch (error) {
    console.error('Error updating OBD-II DTC:', error)
    return NextResponse.json(
      { error: 'Failed to update OBD-II DTC' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.oBDIIDTCDefinition.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting OBD-II DTC:', error)
    return NextResponse.json(
      { error: 'Failed to delete OBD-II DTC' },
      { status: 500 }
    )
  }
}