import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { prisma } from '@/lib/prisma'

// GET /api/oems - Get all OEMs
export async function GET() {
  try {
    // AUTH DISABLED

    const oems = await prisma.oEM.findMany({
      include: {
        _count: {
          select: {
            Model: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(oems)
  } catch (error) {
    console.error('Error fetching OEMs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch OEMs' },
      { status: 500 }
    )
  }
}

// POST /api/oems - Create a new OEM
export async function POST(request: NextRequest) {
  try {
    // AUTH DISABLED

    const body = await request.json()
    const { name, shortName } = body

    if (!name) {
      return NextResponse.json(
        { error: 'OEM name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name
    const existingOEM = await prisma.oEM.findFirst({
      where: {
        OR: [
          { name },
          { shortName: shortName || undefined }
        ]
      }
    })

    if (existingOEM) {
      return NextResponse.json(
        { error: 'OEM with this name or short name already exists' },
        { status: 409 }
      )
    }

    const oem = await prisma.oEM.create({
      data: {
        name,
        shortName: shortName || name // Use name as shortName if not provided
      },
      include: {
        _count: {
          select: {
            Model: true
          }
        }
      }
    })

    return NextResponse.json(oem, { status: 201 })
  } catch (error) {
    console.error('Error creating OEM:', error)
    return NextResponse.json(
      { error: 'Failed to create OEM' },
      { status: 500 }
    )
  }
}