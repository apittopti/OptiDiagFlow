import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all OEMs that have diagnostic jobs
    const oems = await prisma.oEM.findMany({
      where: {
        Model: {
          some: {
            ModelYear: {
              some: {
                Vehicle: {
                  some: {
                    DiagnosticJob: {
                      some: {}
                    }
                  }
                }
              }
            }
          }
        }
      },
      include: {
        Model: {
          where: {
            ModelYear: {
              some: {
                Vehicle: {
                  some: {
                    DiagnosticJob: {
                      some: {}
                    }
                  }
                }
              }
            }
          },
          include: {
            ModelYear: {
              where: {
                Vehicle: {
                  some: {
                    DiagnosticJob: {
                      some: {}
                    }
                  }
                }
              },
              orderBy: { year: 'desc' }
            }
          },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ companies: oems })

  } catch (error) {
    console.error('Error fetching hierarchy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hierarchy' },
      { status: 500 }
    )
  }
}