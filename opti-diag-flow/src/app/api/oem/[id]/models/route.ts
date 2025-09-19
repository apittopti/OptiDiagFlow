import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // AUTH DISABLED
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { name, platform, years } = body

    // Validate OEM exists
    const oem = await prisma.oEM.findUnique({
      where: { id }
    })

    if (!oem) {
      return NextResponse.json({ error: 'OEM not found' }, { status: 404 })

    // Check if model already exists
    const existingModel = await prisma.model.findFirst({
      where: {
        oemId: id,
        name
      }
    })

    if (existingModel) {
      return NextResponse.json({ error: 'Model already exists for this OEM' }, { status: 400 })

    // Create model with model years
    const model = await prisma.model.create({
      data: {
        oemId: id,
        name,
        platform: platform || null,
        modelYears: {
          create: years.map((year: number) => ({
            year
          }))
        }
      },
      include: {
        modelYears: true,
        oem: true
      }
    })

    return NextResponse.json(model)
  } catch (error) {
    console.error('Error creating model:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const models = await prisma.model.findMany({
      where: { oemId: params.id },
      include: {
        modelYears: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(models)
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}