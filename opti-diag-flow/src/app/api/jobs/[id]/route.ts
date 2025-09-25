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

    // Check if job exists
    const job = await prisma.diagnosticJob.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Delete the job (cascade will handle related data)
    await prisma.diagnosticJob.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: `Job "${job.name}" deleted successfully`
    })
  } catch (error: any) {
    console.error('Error deleting job:', error)

    // Provide more detailed error information
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete job due to foreign key constraint' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to delete job',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}