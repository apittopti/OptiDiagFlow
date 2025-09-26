import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const oemId = searchParams.get('oemId')
    const modelId = searchParams.get('modelId')
    const modelYearId = searchParams.get('modelYearId')
    const ecuAddress = searchParams.get('ecuAddress')
    const severity = searchParams.get('severity')
    const category = searchParams.get('category')
    const isVerified = searchParams.get('verified')
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

    if (oemId) where.oemId = oemId
    if (modelId) where.modelId = modelId
    if (modelYearId) where.modelYearId = modelYearId
    if (ecuAddress) where.ecuAddress = ecuAddress
    if (severity) where.severity = severity
    if (category) where.category = category
    if (isVerified !== null) where.isVerified = isVerified === 'true'

    const [dtcs, total] = await Promise.all([
      prisma.dTCDefinition.findMany({
        where,
        include: {
          oem: true,
          model: true,
          modelYear: true,
          statusBits: true,
          _count: {
            select: {
              auditLogs: true
            }
          }
        },
        orderBy: [
          { code: 'asc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.dTCDefinition.count({ where })
    ])

    return NextResponse.json({
      dtcs,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching DTC definitions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch DTC definitions' },
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
      severity,
      category,
      system,
      oemId,
      modelId,
      modelYearId,
      ecuAddress,
      symptoms,
      causes,
      diagnosticSteps,
      repairActions
    } = body

    // Validate required fields
    if (!code || !name || !oemId || !modelId || !modelYearId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if DTC already exists
    const existing = await prisma.dTCDefinition.findFirst({
      where: {
        code,
        ecuAddress: ecuAddress || null,
        oemId,
        modelId,
        modelYearId
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'DTC definition already exists for this context' },
        { status: 409 }
      )
    }

    // Get or create knowledge source
    let source = await prisma.knowledgeSource.findFirst({
      where: {
        type: 'MANUAL_ENTRY',
        name: 'Manual DTC Entry'
      }
    })

    if (!source) {
      source = await prisma.knowledgeSource.create({
        data: {
          type: 'MANUAL_ENTRY',
          name: 'Manual DTC Entry'
        }
      })
    }

    const dtc = await prisma.dTCDefinition.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        severity: severity || 'INFORMATIONAL',
        category,
        system,
        oemId,
        modelId,
        modelYearId,
        ecuAddress,
        symptoms,
        causes,
        diagnosticSteps,
        repairActions,
        sourceId: source.id,
        isVerified: false
      },
      include: {
        oem: true,
        model: true,
        modelYear: true
      }
    })

    return NextResponse.json(dtc, { status: 201 })
  } catch (error) {
    console.error('Error creating DTC definition:', error)
    return NextResponse.json(
      { error: 'Failed to create DTC definition' },
      { status: 500 }
    )
  }
}