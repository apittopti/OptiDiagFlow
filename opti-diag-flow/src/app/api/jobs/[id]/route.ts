import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const job = await prisma.diagnosticJob.findUnique({
      where: { id },
      include: {
        Vehicle: {
          include: {
            ModelYear: {
              include: {
                Model: {
                  include: {
                    OEM: true
                  }
                }
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
        },
        Tag: true,
        ECUConfiguration: true,
        DataIdentifier: true,
        DTC: true,
        Routine: true,
        _count: {
          select: {
            ECUConfiguration: true,
            DataIdentifier: true,
            DTC: true,
            Routine: true,
            Tag: true
          }
        }
      }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status, procedureType } = body

    const job = await prisma.diagnosticJob.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(procedureType && { procedureType })
      },
      include: {
        Vehicle: {
          include: {
            ModelYear: {
              include: {
                Model: {
                  include: {
                    OEM: true
                  }
                }
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
        },
        Tag: true,
        _count: {
          select: {
            ECUConfiguration: true,
            DataIdentifier: true,
            DTC: true,
            Routine: true,
            Tag: true
          }
        }
      }
    })

    return NextResponse.json(job)
  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Delete the job (cascade will handle related data)
    await prisma.diagnosticJob.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    )
  }
}