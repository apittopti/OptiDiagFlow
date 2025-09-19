import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// GET - List all model years or years for a specific model
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    const where = modelId ? { modelId } : {};

    const modelYears = await prisma.modelYear.findMany({
      where,
      include: {
        model: {
          include: {
            oem: true
          }
        },
        vehicles: true
      },
      orderBy: {
        year: 'desc'
      }
    });

    return NextResponse.json(modelYears);
  } catch (error) {
    console.error('Error fetching model years:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model years' },
      { status: 500 }
    );
  }
}

// POST - Create new model year
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { modelId, year } = body;

    if (!modelId || !year) {
      return NextResponse.json(
        { error: 'Model ID and year are required' },
        { status: 400 }
      );

    const modelYear = await prisma.modelYear.create({
      data: {
        modelId,
        year: parseInt(year)
      },
      include: {
        model: {
          include: {
            oem: true
          }
        }
      }
    });

    return NextResponse.json(modelYear, { status: 201 });
  } catch (error) {
    console.error('Error creating model year:', error);
    return NextResponse.json(
      { error: 'Failed to create model year' },
      { status: 500 }
    );
  }
}