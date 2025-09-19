import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ecuProfileId = searchParams.get('ecuProfile')
    const isStandardOnly = searchParams.get('standardOnly') === 'true'

    if (ecuProfileId) {
      // Get DIDs for specific ECU profile
      const ecuSpecificDIDs = await prisma.eCUSpecificDID.findMany({
        where: {
          ecuProfileId: ecuProfileId,
          ...(isStandardOnly && { ecuSpecific: false })
        },
        include: {
          standardDID: true,
          ecuProfile: {
            include: {
              ecuType: true
            }
          }
        },
        orderBy: {
          didId: 'asc'
        }
      })

      return NextResponse.json(ecuSpecificDIDs)
    } else {
      // Get all standard DIDs
      const standardDIDs = await prisma.standardDID.findMany({
        include: {
          ecuSpecificDIDs: {
            include: {
              ecuProfile: {
                include: {
                  ecuType: true
                }
              }
            }
          },
          _count: {
            select: {
              ecuSpecificDIDs: true,
              companyDIDs: true
            }
          }
        },
        orderBy: {
          didId: 'asc'
        }
      })

      // Transform to include ECU support information
      const transformedDIDs = standardDIDs.map(did => ({
        ...did,
        ecuSupport: did.ecuSpecificDIDs.reduce((acc: any, ecuDID: any) => {
          const ecuName = ecuDID.ecuProfile.ecuType.name
          if (!acc[ecuName]) {
            acc[ecuName] = []
          }
          acc[ecuName].push({
            isSupported: ecuDID.isSupported,
            dataLength: ecuDID.dataLength,
            format: ecuDID.format,
            notes: ecuDID.notes
          })
          return acc
        }, {}),
        supportedECUCount: did.ecuSpecificDIDs.filter((ecuDID: any) => ecuDID.isSupported).length,
        totalECUCount: did.ecuSpecificDIDs.length
      }))

      return NextResponse.json(transformedDIDs)
  } catch (error) {
    console.error('Error fetching DIDs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DIDs' },
      { status: 500 }
    )
  }
}