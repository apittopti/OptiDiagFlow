import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const oem = await prisma.oEM.findUnique({
      where: { id: params.id },
      include: {
        models: {
          include: {
            modelYears: true
          }
        }
      }
    })

    if (!oem) {
      return NextResponse.json({ error: 'OEM not found' }, { status: 404 })

    return NextResponse.json(oem)
  } catch (error) {
    console.error('Error fetching OEM:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, shortName, defaultDTCFormat } = body

    const oem = await prisma.oEM.update({
      where: { id: params.id },
      data: {
        name,
        shortName,
        defaultDTCFormat
      },
      include: {
        models: {
          include: {
            modelYears: true
          }
        }
      }
    })

    return NextResponse.json(oem)
  } catch (error) {
    console.error('Error updating OEM:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Delete OEM (cascade will handle models, modelyears, vehicles)
    await prisma.oEM.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting OEM:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}