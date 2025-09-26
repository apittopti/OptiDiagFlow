import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const system = searchParams.get('system')
    const category = searchParams.get('category')
    const isGeneric = searchParams.get('generic')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (system) where.system = system
    if (category) where.category = category
    if (isGeneric !== null) where.isGeneric = isGeneric === 'true'

    const [dtcs, total] = await Promise.all([
      prisma.oBDIIDTCDefinition.findMany({
        where,
        orderBy: { code: 'asc' },
        take: limit,
        skip: offset
      }),
      prisma.oBDIIDTCDefinition.count({ where })
    ])

    return NextResponse.json({
      dtcs,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching OBD-II DTCs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OBD-II DTCs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      code,
      name,
      description,
      system,
      category,
      isGeneric,
      symptoms,
      causes,
      diagnosticSteps,
      repairActions
    } = body

    // Validate required fields
    if (!code || !name || !system) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if DTC already exists
    const existing = await prisma.oBDIIDTCDefinition.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'OBD-II DTC already exists' },
        { status: 409 }
      )
    }

    const dtc = await prisma.oBDIIDTCDefinition.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        system,
        category,
        isGeneric: isGeneric !== undefined ? isGeneric : true,
        symptoms,
        causes,
        diagnosticSteps,
        repairActions
      }
    })

    return NextResponse.json(dtc, { status: 201 })
  } catch (error) {
    console.error('Error creating OBD-II DTC:', error)
    return NextResponse.json(
      { error: 'Failed to create OBD-II DTC' },
      { status: 500 }
    )
  }
}