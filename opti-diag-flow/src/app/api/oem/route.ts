import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// GET - List all OEMs
export async function GET() {
  try {
    const oems = await prisma.oEM.findMany({
      include: {
        models: {
          include: {
            modelYears: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(oems);
  } catch (error) {
    console.error('Error fetching OEMs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OEMs' },
      { status: 500 }
    );
  }
}

// POST - Create new OEM
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, shortName, defaultDTCFormat } = body;

    if (!name || !shortName) {
      return NextResponse.json(
        { error: 'Name and short name are required' },
        { status: 400 }
      );

    // Check if OEM already exists
    const existingOEM = await prisma.oEM.findFirst({
      where: {
        OR: [
          { name },
          { shortName }
        ]
      }
    });

    if (existingOEM) {
      return NextResponse.json({ error: 'OEM with this name or short name already exists' }, { status: 400 });

    const oem = await prisma.oEM.create({
      data: {
        name,
        shortName,
        defaultDTCFormat: defaultDTCFormat || 'ISO_14229_3_BYTE'
      },
      include: {
        models: {
          include: {
            modelYears: true
          }
        }
      }
    });

    return NextResponse.json(oem, { status: 201 });
  } catch (error) {
    console.error('Error creating OEM:', error);
    return NextResponse.json(
      { error: 'Failed to create OEM' },
      { status: 500 }
    );
  }
}