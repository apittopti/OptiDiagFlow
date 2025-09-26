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

    // Find the trace file for this job
    const fs = require('fs')
    const path = require('path')

    let traceFilePath = ''

    // First check if job metadata contains the full trace file path (from batch import)
    if (job.metadata && typeof job.metadata === 'object') {
      const metadata = job.metadata as any

      // Check for full path first (from batch import)
      if (metadata.traceFilePath && fs.existsSync(metadata.traceFilePath)) {
        traceFilePath = metadata.traceFilePath
        console.log('Using trace file from metadata path:', traceFilePath)
      }
      // Otherwise check uploads directory
      else if (metadata.traceFileName) {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'traces')
        const metadataTraceFileName = metadata.traceFileName

        // Look for the file in the uploads directory
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir)

          // Try exact match first
          if (files.includes(metadataTraceFileName)) {
            traceFilePath = path.join(uploadsDir, metadataTraceFileName)
            console.log('Using exact trace file:', metadataTraceFileName)
          } else {
            // Look for a file that ends with the stored trace file name
            const matchingFile = files.find((f: string) => f.endsWith(metadataTraceFileName))
            if (matchingFile) {
              traceFilePath = path.join(uploadsDir, matchingFile)
              console.log('Using trace file from metadata (suffix match):', matchingFile)
            } else {
              // Try to find file containing the base name (without extension)
              const baseName = metadataTraceFileName.replace(/\.[^/.]+$/, '')
              const matchingFile2 = files.find((f: string) => f.includes(baseName))
              if (matchingFile2) {
                traceFilePath = path.join(uploadsDir, matchingFile2)
                console.log('Using trace file by base name:', matchingFile2)
              }
            }
          }
        }
      }
    }

    // Fallback: try to match by job name in uploads directory
    if (!traceFilePath) {
      console.log('No metadata trace file found, trying fallback matches...')
      const uploadsDir = path.join(process.cwd(), 'uploads', 'traces')
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir)
        console.log(`Searching ${files.length} files for job name: ${job.name}`)

        // Strategy 1: Special handling for numeric job names (Land Rover files)
        if (/^\d+$/.test(job.name)) {
          // Look for files containing the job name as the numeric part
          const matchingFile = files.find((f: string) => f.includes(job.name))
          if (matchingFile) {
            traceFilePath = path.join(uploadsDir, matchingFile)
            console.log('Using numeric-matched trace file:', matchingFile)
          }
        }

        // Strategy 2: Look for files ending with job name + .txt
        if (!traceFilePath) {
          const jobNameWithExt = job.name.endsWith('.txt') ? job.name : `${job.name}.txt`
          const matchingFile = files.find((f: string) => f.endsWith(jobNameWithExt))
          if (matchingFile) {
            traceFilePath = path.join(uploadsDir, matchingFile)
            console.log('Using suffix-matched trace file:', matchingFile)
          }
        }

        // Strategy 3: For other jobs, try fuzzy matching
        if (!traceFilePath) {
          const jobNamePart = job.name?.replace(/[^a-zA-Z0-9]/g, '') || ''
          if (jobNamePart) {
            const matchingFile = files.find((f: string) => {
              const filePart = f.replace(/[^a-zA-Z0-9]/g, '')
              return filePart.includes(jobNamePart) || jobNamePart.includes(filePart.substring(0, 7))
            })

            if (matchingFile) {
              traceFilePath = path.join(uploadsDir, matchingFile)
              console.log('Using fuzzy-matched trace file:', matchingFile)
            }
          }
        }
      }
    }

    if (!traceFilePath || !fs.existsSync(traceFilePath)) {
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

    // Extract the trace filename from the path
    const baseTraceFileName = path.basename(traceFilePath)

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
      traceFileName: baseTraceFileName,
      startTime: parsedData.metadata?.startTime,
      endTime: parsedData.metadata?.endTime,
      duration: parsedData.metadata?.duration,
      // Include Jifeline metadata from parser
      vehicleVoltage: parsedData.metadata?.vehicleVoltage,
      connectionInfo: parsedData.metadata?.connectionInfo,
      connectorMetrics: parsedData.metadata?.connectorMetrics,
      ecuChannels: parsedData.metadata?.ecuChannels,
      metadataMessages: parsedData.metadata?.metadataMessages,
      // Add flag to indicate if messages were truncated (for future use)
      messagesComplete: true
    }

    // Update the job
    await prisma.diagnosticJob.update({
      where: { id: jobId },
      data: {
        messageCount: parsedData.messages.length,
        duration: parsedData.metadata?.duration || 0,
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