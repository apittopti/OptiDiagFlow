import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const hierarchy = await prisma.oEM.findMany({
      include: {
        Model: {
          include: {
            ModelYear: {
              select: {
                id: true,
                year: true,
                _count: {
                  select: {
                    Vehicle: true
                  }
                }
              },
              orderBy: {
                year: 'desc'
              }
            },
            _count: {
              select: {
                ModelYear: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        },
        _count: {
          select: {
            Model: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(hierarchy);
  } catch (error) {
    console.error('Error fetching vehicle hierarchy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle hierarchy' },
      { status: 500 }
    );
  }
}