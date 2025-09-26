import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dtc = await prisma.dTCDefinition.findUnique({
      where: { id: params.id },
      include: {
        oem: true,
        model: true,
        modelYear: true,
        statusBits: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    })

    if (!dtc) {
      return NextResponse.json(
        { error: 'DTC definition not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(dtc)
  } catch (error) {
    console.error('Error fetching DTC definition:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DTC definition' },
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
      severity,
      category,
      system,
      symptoms,
      causes,
      diagnosticSteps,
      repairActions,
      isVerified
    } = body

    const dtc = await prisma.dTCDefinition.update({
      where: { id: params.id },
      data: {
        name,
        description,
        severity,
        category,
        system,
        symptoms,
        causes,
        diagnosticSteps,
        repairActions,
        isVerified,
        version: { increment: 1 }
      },
      include: {
        oem: true,
        model: true,
        modelYear: true
      }
    })

    // Create audit log
    await prisma.dTCDefinitionAudit.create({
      data: {
        dtcDefinitionId: params.id,
        action: 'MODIFIED',
        fieldName: 'multiple',
        oldValue: null,
        newValue: JSON.stringify(body),
        performedBy: 'System' // Replace with actual user when auth is implemented
      }
    })

    return NextResponse.json(dtc)
  } catch (error) {
    console.error('Error updating DTC definition:', error)
    return NextResponse.json(
      { error: 'Failed to update DTC definition' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if DTC is used in any jobs
    const usedInJobs = await prisma.dTC.findFirst({
      where: {
        code: {
          in: await prisma.dTCDefinition.findUnique({
            where: { id: params.id },
            select: { code: true }
          }).then(dtc => dtc ? [dtc.code] : [])
        }
      }
    })

    if (usedInJobs) {
      return NextResponse.json(
        { error: 'Cannot delete DTC definition that is referenced in diagnostic jobs' },
        { status: 409 }
      )
    }

    await prisma.dTCDefinition.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting DTC definition:', error)
    return NextResponse.json(
      { error: 'Failed to delete DTC definition' },
      { status: 500 }
    )
  }
}