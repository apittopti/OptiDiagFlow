import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { discoverKnowledge } from '@/lib/knowledge-discovery';

// POST - Discover knowledge from a diagnostic job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, autoApplyThreshold = 0.9 } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get the job and its trace data
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: jobId },
      include: {
        Vehicle: {
          include: {
            ModelYear: {
              include: {
                Model: {
                  include: {
                    OEM: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if metadata contains trace messages
    if (!job.metadata || typeof job.metadata !== 'object') {
      return NextResponse.json(
        { error: 'Job does not contain trace data' },
        { status: 400 }
      );
    }

    // Extract trace messages from job metadata
    const metadata = job.metadata as any;
    const messages = metadata.messages || metadata.traceMessages || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'No trace messages found in job' },
        { status: 400 }
      );
    }

    // Run discovery
    const discoverySession = await discoverKnowledge(
      jobId,
      messages,
      session.user.email,
      autoApplyThreshold
    );

    // Get discovery results
    const discoveries = await prisma.discovery.findMany({
      where: { sessionId: discoverySession.id },
      orderBy: [
        { confidence: 'desc' },
        { type: 'asc' },
        { identifier: 'asc' },
      ],
    });

    return NextResponse.json({
      session: discoverySession,
      discoveries,
      summary: {
        total: discoveries.length,
        autoApplied: discoveries.filter((d) => d.status === 'AUTO_APPLIED').length,
        pending: discoveries.filter((d) => d.status === 'PENDING').length,
        byType: {
          ecu: discoveries.filter((d) => d.type === 'ECU').length,
          service: discoveries.filter((d) => d.type === 'SERVICE').length,
          did: discoveries.filter((d) => d.type === 'DID').length,
          dtc: discoveries.filter((d) => d.type === 'DTC').length,
          routine: discoveries.filter((d) => d.type === 'ROUTINE').length,
        },
      },
    });
  } catch (error) {
    console.error('Error discovering knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to discover knowledge' },
      { status: 500 }
    );
  }
}

// GET - Get discovery sessions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');

    const where: any = {};
    if (jobId) where.jobId = jobId;
    if (status) where.status = status;

    const sessions = await prisma.discoverySession.findMany({
      where,
      include: {
        _count: {
          select: { discoveries: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching discovery sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovery sessions' },
      { status: 500 }
    );
  }
}