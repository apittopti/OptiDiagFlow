import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JifelineParser } from '@/lib/trace-parser/jifeline-parser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

    // Get the job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Find the uploaded trace file for this job
    const fs = require('fs')
    const path = require('path')

    // Find the trace file for this job
    // Map job names to trace files based on what we know was uploaded
    const jobNameToTraceMap: Record<string, string> = {
      // Honda jobs
      'Honda Jazz Test': 'HONDA_JAZZ_CAM_RYDS.txt',

      // Land Rover jobs
      '8873778': '8873778.txt',
      '8884157': '8884157.txt'
    }

    let traceFilePath = ''
    const uploadsDir = path.join(process.cwd(), 'uploads', 'traces')

    // First try to find based on job name mapping
    const mappedFile = jobNameToTraceMap[job.name]
    if (mappedFile) {
      const files = fs.readdirSync(uploadsDir)
      const matchingFile = files.find((f: string) => f.includes(mappedFile))
      if (matchingFile) {
        traceFilePath = path.join(uploadsDir, matchingFile)
        console.log('Using mapped trace file:', matchingFile)
      }
    }

    // If not found, try to match by job name
    if (!traceFilePath) {
      const files = fs.readdirSync(uploadsDir)

      // Special handling for numeric job names (Land Rover files)
      if (/^\d+$/.test(job.name)) {
        // Look for files containing the job name as the numeric part
        const matchingFile = files.find((f: string) => f.includes(job.name))
        if (matchingFile) {
          traceFilePath = path.join(uploadsDir, matchingFile)
          console.log('Using numeric-matched trace file:', matchingFile)
        }
      } else {
        // For other jobs, try fuzzy matching
        const jobNamePart = job.name?.replace(/[^a-zA-Z0-9]/g, '') || ''
        if (jobNamePart) {
          const matchingFile = files.find((f: string) => {
            const filePart = f.replace(/[^a-zA-Z0-9]/g, '')
            return filePart.includes(jobNamePart) || jobNamePart.includes(filePart.substring(0, 7))
          })

          if (matchingFile) {
            traceFilePath = path.join(uploadsDir, matchingFile)
            console.log('Using name-matched trace file:', matchingFile)
          }
        }
      }
    }

    if (!traceFilePath) {
      return NextResponse.json({ error: 'No trace file found for this job' }, { status: 404 })
    }

    let rawContent: string
    try {
      rawContent = fs.readFileSync(traceFilePath, 'utf8')
    } catch (error) {
      console.error('Error reading trace file:', error)
      return NextResponse.json({ error: 'Could not read trace file' }, { status: 500 })
    }

    // Parse the trace content with JifelineParser (same as job creation)
    console.log('Reparsing trace file with JifelineParser...')
    const parser = new JifelineParser()
    const parsedData = parser.parseTrace(rawContent)

    // Get discovered ECUs
    const discoveredECUs = parser.getDiscoveredECUs()

    console.log(`Parsed ${parsedData.messages.length} messages`)
    console.log(`Discovered ${discoveredECUs.size} ECUs:`)

    // Delete existing ECUs, DTCs, DIDs, and Routines for this job
    await prisma.eCUConfiguration.deleteMany({ where: { jobId } })
    await prisma.dTC.deleteMany({ where: { jobId } })
    await prisma.dataIdentifier.deleteMany({ where: { jobId } })
    await prisma.routine.deleteMany({ where: { jobId } })

    // Store discovered ECUs and their data
    let totalDTCs = 0
    let totalDIDs = 0
    let totalRoutines = 0

    for (const [address, ecu] of discoveredECUs) {
      console.log(`Processing ECU ${ecu.name} (${address}): ${ecu.messageCount} messages`)
      console.log(`  Services: ${Array.from(ecu.discoveredServices).join(', ')}`)
      console.log(`  DTCs: ${ecu.discoveredDTCs.size}`)
      console.log(`  DIDs: ${ecu.discoveredDIDs.size}`)
      console.log(`  Routines: ${ecu.discoveredRoutines.size}`)

      // Create ECU configuration
      await prisma.eCUConfiguration.create({
        data: {
          jobId,
          ecuName: ecu.name,
          sourceAddress: '0E80', // Tester address
          targetAddress: address,
          metadata: {
            protocol: ecu.protocol,
            messageCount: ecu.messageCount,
            firstSeen: ecu.firstSeen.toISOString(),
            lastSeen: ecu.lastSeen.toISOString(),
            sessionTypes: Array.from(ecu.sessionTypes),
            securityLevels: Array.from(ecu.securityLevels),
            services: Array.from(ecu.discoveredServices)
          }
        }
      })

      // Store DTCs for this ECU
      for (const [dtcCode, dtcInfo] of ecu.discoveredDTCs) {
        await prisma.dTC.create({
          data: {
            code: dtcCode,
            jobId,
            ecuName: ecu.name,
            status: dtcInfo.status || 'UNKNOWN',
            statusByte: dtcInfo.statusByte || '',
            rawHex: dtcInfo.rawHex || '', // Re-enabled after Prisma client regeneration
            description: dtcInfo.description || `DTC ${dtcCode}`
          }
        })
        totalDTCs++
      }

      // Store DIDs for this ECU
      for (const [did, didInfo] of ecu.discoveredDIDs) {
        await prisma.dataIdentifier.create({
          data: {
            jobId,
            ecuName: ecu.name,
            did,
            name: didInfo.name || `DID_${did}`,
            dataLength: didInfo.dataLength,
            dataType: didInfo.dataType || 'BINARY',
            sampleValues: didInfo.sampleValues || []
          }
        })
        totalDIDs++
      }

      // Store Routines for this ECU
      for (const [routineId, routineInfo] of ecu.discoveredRoutines) {
        await prisma.routine.create({
          data: {
            routineId,
            jobId,
            ecuName: ecu.name,
            name: routineInfo.name || `Routine_${routineId}`,
            controlType: routineInfo.metadata?.controlType || routineInfo.controlType || 'unknown',
            hasInput: !!(routineInfo.metadata?.inputData || routineInfo.inputData),
            hasOutput: !!(routineInfo.metadata?.outputData?.length || routineInfo.outputData?.length)
          }
        })
        totalRoutines++
      }
    }

    // Update job metadata - store ALL messages for complete UDS Flow display
    // Store messages in chunks if needed for very large traces
    const allMessages = parsedData.messages
    const metadata = {
      messageCount: allMessages.length,
      ecuCount: discoveredECUs.size,
      // Store ALL messages for UDS Flow tab - critical for diagnostic analysis
      messages: allMessages, // Store ALL messages, not just first 1000
      ecus: Array.from(discoveredECUs.values()).map(ecu => ({
        address: ecu.address,
        name: ecu.name,
        protocol: ecu.protocol,
        messageCount: ecu.messageCount,
        services: Array.from(ecu.discoveredServices),
        dtcCount: ecu.discoveredDTCs.size,
        didCount: ecu.discoveredDIDs.size,
        routineCount: ecu.discoveredRoutines.size
      })),
      startTime: parsedData.metadata?.startTime,
      endTime: parsedData.metadata?.endTime,
      duration: parsedData.metadata?.duration,
      // Add flag to indicate if messages were truncated (for future use)
      messagesComplete: true
    }

    // Update the job
    await prisma.diagnosticJob.update({
      where: { id: jobId },
      data: {
        messageCount: parsedData.messages.length,
        metadata: metadata as any,
        status: 'ACTIVE'
      }
    })

    console.log(`Reparse complete: ${discoveredECUs.size} ECUs, ${totalDTCs} DTCs, ${totalDIDs} DIDs, ${totalRoutines} Routines`)

    return NextResponse.json({
      success: true,
      message: 'Job reparsed successfully',
      stats: {
        messages: parsedData.messages.length,
        ecus: discoveredECUs.size,
        dtcs: totalDTCs,
        dids: totalDIDs,
        routines: totalRoutines
      }
    })

  } catch (error) {
    console.error('Error reparsing job:', error)
    return NextResponse.json(
      { error: 'Failed to reparse job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}