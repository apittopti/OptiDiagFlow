import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { codes } = body

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: 'Codes array is required' },
        { status: 400 }
      )
    }

    // Fetch DTCs from database
    const dtcs = await prisma.oBDIIDTCDefinition.findMany({
      where: {
        code: {
          in: codes
        }
      },
      select: {
        code: true,
        name: true,
        description: true,
        system: true,
        isGeneric: true,
        category: true
      }
    })

    // Convert to a map for easy lookup
    const dtcMap: Record<string, any> = {}
    dtcs.forEach(dtc => {
      dtcMap[dtc.code] = {
        name: dtc.name,
        description: dtc.description || dtc.name,
        system: dtc.system,
        isGeneric: dtc.isGeneric,
        category: dtc.category
      }
    })

    // Add fallback descriptions for codes not in database
    codes.forEach(code => {
      if (!dtcMap[code]) {
        dtcMap[code] = {
          name: `DTC ${code}`,
          description: `Diagnostic Trouble Code ${code}`,
          system: code[0] === 'P' ? 'Powertrain' :
                  code[0] === 'B' ? 'Body' :
                  code[0] === 'C' ? 'Chassis' :
                  code[0] === 'U' ? 'Network' : 'Unknown',
          isGeneric: code[1] === '0',
          category: null
        }
      }
    })

    return NextResponse.json(dtcMap)
  } catch (error) {
    console.error('Error looking up OBD-II DTCs:', error)
    return NextResponse.json(
      { error: 'Failed to lookup OBD-II DTCs' },
      { status: 500 }
    )
  }
}
