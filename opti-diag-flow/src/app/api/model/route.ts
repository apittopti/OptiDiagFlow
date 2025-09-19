import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// GET - List all models or models for a specific OEM
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oemId = searchParams.get('oemId');

    const where = oemId ? { oemId } : {};

    const models = await prisma.model.findMany({
      where,
      include: {
        oem: true,
        modelYears: {
          orderBy: {
            year: 'desc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

// POST - Create new model
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { oemId, name, platform } = body;

    if (!oemId || !name) {
      return NextResponse.json(
        { error: 'OEM ID and name are required' },
        { status: 400 }
      );

    const model = await prisma.model.create({
      data: {
        oemId,
        name,
        platform
      },
      include: {
        oem: true
      }
    });

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    console.error('Error creating model:', error);
    return NextResponse.json(
      { error: 'Failed to create model' },
      { status: 500 }
    );
  }
}