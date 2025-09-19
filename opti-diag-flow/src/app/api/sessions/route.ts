import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/sessions - List all trace sessions for the user
export async function GET(request: NextRequest) {
  try {
    // AUTH DISABLED;

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {
      userId: session.user.id
    };

    if (jobId) {
      where.jobId = jobId;

    const [sessions, total] = await Promise.all([
      prisma.traceSession.findMany({
        where,
        include: {
          job: {
            include: {
              vehicle: {
                include: {
                  modelYear: {
                    include: {
                      model: {
                        include: {
                          oem: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: {
              messages: true,
              ecus: true,
              services: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.traceSession.count({ where })
    ]);

    const transformedSessions = sessions.map(session => ({
      id: session.id,
      fileName: session.fileName,
      fileSize: session.fileSize,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      messageCount: session.messageCount,
      ecuCount: session.ecuCount,
      createdAt: session.createdAt,
      job: {
        id: session.job.id,
        name: session.job.name,
        procedureType: session.job.procedureType
      },
      vehicle: {
        oem: session.job.Vehicle.ModelYear.Model.OEM.name,
        model: session.job.Vehicle.ModelYear.Model.name,
        year: session.job.Vehicle.ModelYear.year,
        vin: session.job.Vehicle.vin
      },
      stats: {
        messages: session._count.messages,
        ecus: session._count.ecus,
        services: session._count.services
      }
    }));

    return NextResponse.json({
      success: true,
      sessions: transformedSessions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}