import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JifelineParser } from '@/lib/trace-parser/jifeline-parser'
import { discoverKnowledgeFromJob } from '@/lib/knowledge-discovery'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check authentication - temporarily skip for testing
    const session = await getServerSession(authOptions)
    let userId = session?.user?.id

    // For testing - use test user if no session
    if (!userId) {
      let testUser = await prisma.user.findFirst({
        where: { email: 'test@example.com' }
      })
      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      }
      userId = testUser.id
    }

    // Get the job with its metadata
    const job = await prisma.diagnosticJob.findUnique({
      where: { id },
      include: {
        Vehicle: true
      }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if we have trace data to reparse
    if (!job.metadata || typeof job.metadata !== 'object') {
      return NextResponse.json(
        { error: 'No trace data available for reparsing' },
        { status: 400 }
      )
    }

    const metadata = job.metadata as any
    const procedures = metadata.procedures

    if (!procedures || procedures.length === 0) {
      return NextResponse.json(
        { error: 'No procedure data available for reparsing' },
        { status: 400 }
      )
    }

    console.log(`Reparsing job ${id} with ${procedures.length} procedures`)

    // Clear existing parsed data
    await Promise.all([
      prisma.eCUConfiguration.deleteMany({ where: { jobId: id } }),
      prisma.dataIdentifier.deleteMany({ where: { jobId: id } }),
      prisma.dTC.deleteMany({ where: { jobId: id } }),
      prisma.routine.deleteMany({ where: { jobId: id } })
    ])

    // Create new parser instance
    const parser = new JifelineParser()

    // Reconstruct trace content from stored procedures
    const lines: string[] = []
    let lineNum = 1

    for (const procedure of procedures) {
      if (!procedure.messages) continue

      for (const msg of procedure.messages) {
        const timestamp = msg.timestamp || '00:00:00.000'
        const direction = msg.direction || 'Local->Remote'
        let sourceAddr = msg.sourceAddr || '0000'
        let targetAddr = msg.targetAddr || '0000'
        const data = msg.data || ''

        // Fix for old data that has incorrect addresses
        // If this is a response (Remote->Local) and source is 0E80, swap them
        if (direction === 'Remote->Local' && sourceAddr === '0E80') {
          // This was stored incorrectly, swap to fix
          [sourceAddr, targetAddr] = [targetAddr, sourceAddr]
        }

        // Reconstruct Jifeline format with corrected addresses
        const line = `${lineNum}→${timestamp} | [${direction.split('->')[0]}]->[${direction.split('->')[1]}] DOIP => [0] source[${sourceAddr}] target[${targetAddr}] data[${data}]`
        lines.push(line)
        lineNum++
      }
    }

    const traceContent = lines.join('\n')

    // Parse the reconstructed trace
    const parsedData = parser.parseTrace(traceContent)
    console.log(`Reparsed ${parsedData.messages.length} messages`)

    // Get discovered ECUs
    const discoveredECUs = parser.getDiscoveredECUs()
    console.log(`Discovered ${discoveredECUs.size} ECUs`)

    // Store reparsed ECU data
    for (const [address, ecu] of discoveredECUs) {
      console.log(`Processing ECU ${ecu.name} (${address})`)

      await prisma.eCUConfiguration.create({
        data: {
          jobId: id,
          ecuName: ecu.name,
          sourceAddress: '0E80',
          targetAddress: address,
          metadata: {
            protocol: ecu.protocol,
            messageCount: ecu.messageCount,
            firstSeen: ecu.firstSeen.toISOString(),
            lastSeen: ecu.lastSeen.toISOString(),
            sessionTypes: Array.from(ecu.sessionTypes),
            securityLevels: Array.from(ecu.securityLevels)
          }
        }
      })

      // Store discovered DIDs
      for (const [did, didInfo] of ecu.discoveredDIDs) {
        await prisma.dataIdentifier.create({
          data: {
            jobId: id,
            ecuName: ecu.name,
            did,
            name: didInfo.name || `DID_${did}`,
            dataLength: didInfo.dataLength,
            dataType: didInfo.dataType || 'BINARY',
            sampleValues: didInfo.sampleValues
          }
        })
      }

      // Store discovered DTCs
      for (const [code, dtcInfo] of ecu.discoveredDTCs) {
        await prisma.dTC.create({
          data: {
            jobId: id,
            ecuName: ecu.name,
            code,
            status: dtcInfo.status,
            statusByte: dtcInfo.statusByte,
            description: dtcInfo.description
          }
        })
      }

      // Store discovered routines
      for (const [routineId, routineInfo] of ecu.discoveredRoutines) {
        await prisma.routine.create({
          data: {
            jobId: id,
            ecuName: ecu.name,
            routineId,
            name: routineInfo.name || `Routine_${routineId}`,
            controlType: routineInfo.controlType,
            hasInput: !!routineInfo.inputData,
            hasOutput: routineInfo.outputData && routineInfo.outputData.length > 0
          }
        })
      }
    }

    // Update job metadata with reparse info
    await prisma.diagnosticJob.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          procedures: parsedData.procedures,
          ecuCount: discoveredECUs.size,
          lastReparsedAt: new Date().toISOString()
        },
        messageCount: parsedData.messages.length
      }
    })

    // Discover and update knowledge base with new data
    console.log(`Running knowledge discovery for reparsed job ${id}`)
    try {
      await discoverKnowledgeFromJob(id)
      console.log(`Knowledge discovery completed for reparsed job ${id}`)
    } catch (knowledgeError) {
      console.error(`Knowledge discovery failed for reparsed job ${id}:`, knowledgeError)
    }

    // Fetch updated job with counts
    const updatedJob = await prisma.diagnosticJob.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ECUConfiguration: true,
            DataIdentifier: true,
            DTC: true,
            Routine: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully reparsed job. Found ${discoveredECUs.size} ECUs.`,
      job: updatedJob
    })
  } catch (error) {
    console.error('Error reparsing job:', error)
    return NextResponse.json(
      { error: 'Failed to reparse job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}