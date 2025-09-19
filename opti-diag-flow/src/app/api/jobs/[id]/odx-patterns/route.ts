import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/jobs/[id]/odx-patterns - Get ODX patterns for a job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED;

    const jobId = params.id;

    // Get job to verify it exists and user has access
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: jobId },
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
        }
      }
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );

    // Get ODX discovery results for this job
    const patterns = await prisma.oDXDiscoveryResult.findMany({
      where: { jobId },
      orderBy: [
        { confidence: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Transform patterns for frontend consumption
    const transformedPatterns = patterns.map(pattern => ({
      id: pattern.id,
      type: pattern.type,
      ecuAddress: pattern.ecuAddress,
      confidence: pattern.confidence,
      pattern: pattern.pattern,
      metadata: {
        ...pattern.metadata as any,
        vehicle: {
          oem: job.Vehicle.ModelYear.Model.OEM.name,
          model: job.Vehicle.ModelYear.Model.name,
          year: job.Vehicle.ModelYear.year,
          vin: job.Vehicle.vin
        }
      },
      isConfirmed: pattern.isConfirmed,
      createdAt: pattern.createdAt.toISOString()
    }));

    // Group patterns by type for summary
    const summary = {
      total: patterns.length,
      byType: patterns.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byConfidence: patterns.reduce((acc, p) => {
        acc[p.confidence] = (acc[p.confidence] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      confirmed: patterns.filter(p => p.isConfirmed).length,
      uniqueEcus: [...new Set(patterns.map(p => p.ecuAddress))].length
    };

    return NextResponse.json({
      success: true,
      patterns: transformedPatterns,
      summary,
      job: {
        id: job.id,
        name: job.name,
        procedureType: job.procedureType,
        vehicle: {
          oem: job.Vehicle.ModelYear.Model.OEM.name,
          model: job.Vehicle.ModelYear.Model.name,
          year: job.Vehicle.ModelYear.year
        }
      }
    });
  } catch (error) {
    console.error('Error fetching ODX patterns:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ODX patterns',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}