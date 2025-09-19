import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // AUTH DISABLED


    const body = await request.json()
    const { type, id, description, technicalNotes } = body

    if (!type || !id) {
      return NextResponse.json({ error: 'Type and ID are required' }, { status: 400 })

    let result

    switch (type) {
      case 'ecu':
        result = await prisma.eCUMapping.update({
          where: { id },
          data: {
            description,
            technicalNotes
          }
        })
        break

      case 'dtc':
      case 'service':
      case 'routine':
      case 'did':
        // All discovery results use the same model
        result = await prisma.oDXDiscoveryResult.update({
          where: { id },
          data: {
            description,
            technicalNotes
          }
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error updating ODX description:', error)
    return NextResponse.json(
      { error: 'Failed to update description' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // AUTH DISABLED


    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })

    // Get all ODX data for the specified model
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        modelYears: {
          include: {
            ecuMappings: {
              orderBy: {
                ecuAddress: 'asc'
              }
            },
            vehicles: {
              include: {
                diagnosticJobs: {
                  include: {
                    odxDiscoveries: {
                      orderBy: {
                        createdAt: 'desc'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })

    // Process and structure the data
    const ecuMappings = model.modelYears.flatMap(my => my.ecuMappings)
    const uniqueEcus = Array.from(
      new Map(ecuMappings.map(ecu => [ecu.ecuAddress, ecu])).values()
    )

    // Get all discoveries for this model
    const discoveries = model.modelYears.flatMap(my =>
      my.vehicles.flatMap(v =>
        v.diagnosticJobs.flatMap(j => j.odxDiscoveries)
      )
    )

    // Group discoveries by type
    const dtcs = discoveries.filter(d => d.type === 'DTC')
    const services = discoveries.filter(d => d.type === 'SERVICE')
    const routines = discoveries.filter(d => d.type === 'ROUTINE')
    const dids = discoveries.filter(d => d.type === 'DID')

    return NextResponse.json({
      success: true,
      data: {
        model,
        ecus: uniqueEcus,
        dtcs,
        services,
        routines,
        dids
      }
    })
  } catch (error) {
    console.error('Error fetching ODX data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ODX data' },
      { status: 500 }
    )
  }
}