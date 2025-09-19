import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { HierarchyLevel } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'ecu'
    const oemId = searchParams.get('oemId')
    const modelId = searchParams.get('modelId')
    const modelYearId = searchParams.get('modelYearId')

    const where: any = {}

    // Filter by hierarchy levels - no longer using 'level' field
    if (oemId && oemId !== 'all') where.oemId = oemId
    if (modelId && modelId !== 'all') where.modelId = modelId
    if (modelYearId && modelYearId !== 'all') where.modelYearId = modelYearId

    let data: any[] = []

    switch (type) {
      case 'ecu':
        data = await prisma.eCUDefinition.findMany({
          where,
          include: {
            oem: true,
            model: true,
            modelYear: true
          },
          orderBy: { address: 'asc' }
        })
        break
      case 'did':
        data = await prisma.dIDDefinition.findMany({
          where,
          include: {
            oem: true,
            model: true,
            modelYear: true
          },
          orderBy: { did: 'asc' }
        })
        break
      case 'dtc':
        data = await prisma.dTCDefinition.findMany({
          where,
          include: {
            oem: true,
            model: true,
            modelYear: true
          },
          orderBy: { code: 'asc' }
        })
        break
      case 'routine':
        data = await prisma.routineDefinition.findMany({
          where,
          include: {
            oem: true,
            model: true,
            modelYear: true
          },
          orderBy: { routineId: 'asc' }
        })
        break
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching definitions:', error)
    return NextResponse.json([])
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, id, name, description } = body

    let updated: any

    switch (type) {
      case 'ecu':
        updated = await prisma.eCUDefinition.update({
          where: { id },
          data: {
            name: name || undefined,
            description: description || undefined,
            updatedAt: new Date()
          }
        })
        break
      case 'did':
        updated = await prisma.dIDDefinition.update({
          where: { id },
          data: {
            name: name || undefined,
            description: description || undefined,
            updatedAt: new Date()
          }
        })
        break
      case 'dtc':
        updated = await prisma.dTCDefinition.update({
          where: { id },
          data: {
            description: description || undefined,
            updatedAt: new Date()
          }
        })
        break
      case 'routine':
        updated = await prisma.routineDefinition.update({
          where: { id },
          data: {
            name: name || undefined,
            description: description || undefined,
            updatedAt: new Date()
          }
        })
        break
      default:
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating definition:', error)
    return NextResponse.json(
      { error: 'Failed to update definition' },
      { status: 500 }
    )
  }
}