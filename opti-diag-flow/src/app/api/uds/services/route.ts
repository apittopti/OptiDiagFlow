import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const ecuTypeId = searchParams.get('ecuType')
    const category = searchParams.get('category')

    let services

    if (ecuTypeId && ecuTypeId !== 'all') {
      // Get services mapped to specific ECU type
      services = await prisma.uDSServiceTemplate.findMany({
        include: {
          ecuServices: {
            where: {
              ecuTypeId: ecuTypeId
            },
            include: {
              ecuType: true
            }
          },
          _count: {
            select: {
              ecuServices: true,
              companyProfiles: true
            }
          }
        },
        where: {
          ...(category && { category }),
          ecuServices: {
            some: {
              ecuTypeId: ecuTypeId
            }
          }
        },
        orderBy: [
          { category: 'asc' },
          { serviceId: 'asc' }
        ]
      })
    } else {
      // Get all services
      services = await prisma.uDSServiceTemplate.findMany({
        include: {
          ecuServices: {
            include: {
              ecuType: true
            }
          },
          _count: {
            select: {
              ecuServices: true,
              companyProfiles: true
            }
          }
        },
        where: {
          ...(category && { category })
        },
        orderBy: [
          { category: 'asc' },
          { serviceId: 'asc' }
        ]
      })

    // Transform the data to include ECU availability information
    const transformedServices = services.map(service => ({
      ...service,
      ecuAvailability: service.ecuServices.reduce((acc: any, mapping: any) => {
        acc[mapping.ecuType.name] = {
          isStandardOnECU: mapping.isStandardOnECU,
          isOptional: mapping.isOptional,
          implementationNotes: mapping.implementationNotes,
          restrictions: mapping.restrictions
        }
        return acc
      }, {}),
      supportedECUTypes: service.ecuServices.map((mapping: any) => ({
        name: mapping.ecuType.name,
        category: mapping.ecuType.category,
        isStandard: mapping.isStandardOnECU,
        isOptional: mapping.isOptional
      }))
    }))

    return NextResponse.json(transformedServices)
  } catch (error) {
    console.error('Error fetching UDS services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch UDS services' },
      { status: 500 }
    )
  }
}