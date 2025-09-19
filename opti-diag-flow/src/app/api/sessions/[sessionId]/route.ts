import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/sessions/[sessionId] - Get trace session details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // AUTH DISABLED


    const { sessionId } = await params

    const traceSession = await prisma.traceSession.findUnique({
      where: { id: sessionId },
      include: {
        job: {
          include: {
            vehicle: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        ecus: true,
        services: true,
        messages: {
          take: 100,
          orderBy: { sequence: 'asc' }
        },
        _count: {
          select: { messages: true }
        }
      }
    })

    if (!traceSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )

    return NextResponse.json(traceSession)
  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trace session' },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[sessionId] - Delete trace session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // AUTH DISABLED


    const { sessionId } = await params

    const traceSession = await prisma.traceSession.findUnique({
      where: { id: sessionId },
      include: { job: true }
    })

    if (!traceSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )

    // Only uploader or admin can delete
    if (
      traceSession.userId !== session.user.id &&
      traceSession.job.uploadedBy !== session.user.id &&
      session.user.role !== 'ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )

    // Delete in transaction to ensure all related data is removed
    await prisma.$transaction([
      prisma.doipMessage.deleteMany({ where: { sessionId } }),
      prisma.ecu.deleteMany({ where: { sessionId } }),
      prisma.diagnosticService.deleteMany({ where: { sessionId } }),
      prisma.traceSession.delete({ where: { id: sessionId } })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete trace session' },
      { status: 500 }
    )
  }
}