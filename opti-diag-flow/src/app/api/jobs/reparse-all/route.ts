import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JifelineParser } from '@/lib/trace-parser/jifeline-parser'
// import { discoverKnowledgeFromJob } from '@/lib/knowledge-discovery' // Function needs to be implemented
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'

export async function POST(request: NextRequest) {
  try {
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

    console.log('Starting reparse all jobs process...')

    // Step 1: Clear all knowledge base data in correct order (dependencies first)
    console.log('Clearing knowledge base...')
    // First delete definitions that depend on KnowledgeSource
    await Promise.all([
      prisma.eCUDefinition.deleteMany(),
      prisma.dIDDefinition.deleteMany(),
      prisma.dTCDefinition.deleteMany(),
      prisma.routineDefinition.deleteMany()
    ])
    // Then delete KnowledgeSource
    await prisma.knowledgeSource.deleteMany()

    // Step 2: Get all jobs that have trace data
    const jobs = await prisma.diagnosticJob.findMany({
      where: {
        metadata: {
          not: null
        }
      },
      include: {
        Vehicle: {
          include: {
            ModelYear: {
              include: {
                Model: {
                  include: {
                    OEM: true
                  }
                }
              }
            }
          }
        }
      }
    })

    console.log(`Found ${jobs.length} jobs to reparse`)

    let totalProcessed = 0
    let totalSkipped = 0
    let totalErrors = 0

    // Step 3: Reparse each job
    for (const job of jobs) {
      try {
        console.log(`Processing job ${job.id}: ${job.name}`)

        // Check if we have trace data to reparse
        if (!job.metadata || typeof job.metadata !== 'object') {
          console.log(`Skipping job ${job.id} - no trace data available`)
          totalSkipped++
          continue
        }

        const metadata = job.metadata as any
        const procedures = metadata.procedures

        if (!procedures || procedures.length === 0) {
          console.log(`Skipping job ${job.id} - no procedure data available`)
          totalSkipped++
          continue
        }

        // Clear existing parsed data for this job
        await Promise.all([
          prisma.eCUConfiguration.deleteMany({ where: { jobId: job.id } }),
          prisma.dataIdentifier.deleteMany({ where: { jobId: job.id } }),
          prisma.dTC.deleteMany({ where: { jobId: job.id } }),
          prisma.routine.deleteMany({ where: { jobId: job.id } })
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
            if (direction === 'Remote->Local' && sourceAddr === '0E80') {
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
        console.log(`Reparsed ${parsedData.messages.length} messages for job ${job.id}`)

        // Get discovered ECUs
        const discoveredECUs = parser.getDiscoveredECUs()
        console.log(`Discovered ${discoveredECUs.size} ECUs for job ${job.id}`)

        // Store reparsed ECU data
        for (const [address, ecu] of discoveredECUs) {
          await prisma.eCUConfiguration.create({
            data: {
              jobId: job.id,
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
                jobId: job.id,
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
                jobId: job.id,
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
                jobId: job.id,
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
          where: { id: job.id },
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

        // Run knowledge discovery for this job
        // TODO: Implement knowledge discovery
        // console.log(`Running knowledge discovery for job ${job.id}`)
        // try {
        //   await discoverKnowledgeFromJob(job.id)
        //   console.log(`Knowledge discovery completed for job ${job.id}`)
        // } catch (knowledgeError) {
        //   console.error(`Knowledge discovery failed for job ${job.id}:`, knowledgeError)
        // }

        totalProcessed++
        console.log(`Completed processing job ${job.id} (${totalProcessed}/${jobs.length})`)

      } catch (jobError) {
        console.error(`Error processing job ${job.id}:`, jobError)
        totalErrors++
      }
    }

    console.log(`Reparse all jobs completed: ${totalProcessed} processed, ${totalSkipped} skipped, ${totalErrors} errors`)

    return NextResponse.json({
      success: true,
      message: `Reparse all jobs completed successfully`,
      summary: {
        totalJobs: jobs.length,
        processed: totalProcessed,
        skipped: totalSkipped,
        errors: totalErrors
      }
    })

  } catch (error) {
    console.error('Error in reparse all jobs:', error)
    return NextResponse.json(
      { error: 'Failed to reparse all jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}