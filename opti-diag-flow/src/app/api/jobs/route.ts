import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { JifelineParser } from '@/lib/trace-parser/jifeline-parser'
// import { discoverKnowledgeFromJob } from '@/lib/knowledge-discovery' // Function needs to be implemented

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const status = searchParams.get('status')
    const procedureType = searchParams.get('procedureType')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}

    if (vehicleId) where.vehicleId = vehicleId
    if (status) where.status = status
    if (procedureType) where.procedureType = { contains: procedureType, mode: 'insensitive' }

    const [jobs, total] = await Promise.all([
      prisma.diagnosticJob.findMany({
        where,
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
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          Tag: true,
          _count: {
            select: {
              ECUConfiguration: true,
              DataIdentifier: true,
              DTC: true,
              Routine: true,
              Tag: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.diagnosticJob.count({ where })
    ])

    return NextResponse.json({
      jobs,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch diagnostic jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let body: any = null
  let session: any = null

  try {
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

    session = {
      user: {
        id: testUser.id,
        name: testUser.name,
        email: testUser.email
      }
    }

    body = await request.json()
    const { name, jobType, vehicleModelYearId, vin, traceFiles } = body

    if (!name || !jobType || !vehicleModelYearId) {
      return NextResponse.json(
        { error: 'Name, job type, and vehicle model year are required' },
        { status: 400 }
      )
    }

    const modelYear = await prisma.modelYear.findUnique({
      where: { id: vehicleModelYearId },
      include: {
        Model: {
          include: {
            OEM: true
          }
        }
      }
    })

    if (!modelYear) {
      return NextResponse.json(
        { error: 'Model year not found' },
        { status: 404 }
      )
    }

    let vehicle = await prisma.vehicle.findFirst({
      where: {
        modelYearId: vehicleModelYearId,
        vin: vin || null
      }
    })

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          modelYearId: vehicleModelYearId,
          vin: vin || null,
          createdBy: session.user.id
        }
      })
    }

    const job = await prisma.diagnosticJob.create({
      data: {
        name,
        procedureType: jobType,
        status: 'DRAFT',
        vehicleId: vehicle.id,
        uploadedBy: session.user.id,
        messageCount: 0,
        duration: 0
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
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (traceFiles && traceFiles.length > 0) {
      console.log(`Processing ${traceFiles.length} trace files for job ${job.id}`)

      for (const traceFile of traceFiles) {
        try {
          await processTraceFile(job.id, traceFile)
        } catch (traceError) {
          console.error(`Failed to process trace file ${traceFile.name}:`, traceError)
        }
      }

      await prisma.diagnosticJob.update({
        where: { id: job.id },
        data: { status: 'ACTIVE' }
      })
    }

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: 'Failed to create job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processTraceFile(jobId: string, traceFile: { name: string, content: string, path?: string, fileName?: string }) {
  console.log(`Processing trace file: ${traceFile.name}`)
  console.log(`Trace file path provided: ${traceFile.path || 'NO PATH PROVIDED'}`)
  console.log(`Trace file fileName provided: ${traceFile.fileName || 'NO FILENAME PROVIDED'}`)

  const parser = new JifelineParser()
  const parsedData = parser.parseTrace(traceFile.content)

  console.log(`Parsed ${parsedData.messages.length} messages from ${traceFile.name}`)

  const discoveredECUs = parser.getDiscoveredECUs()
  console.log(`Discovered ${discoveredECUs.size} ECUs`)

  for (const [address, ecu] of discoveredECUs) {
    console.log(`Processing ECU ${ecu.name} (${address})`)

    await prisma.eCUConfiguration.create({
      data: {
        jobId,
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

    for (const [did, didInfo] of ecu.discoveredDIDs) {
      await prisma.dataIdentifier.create({
        data: {
          jobId,
          ecuName: ecu.name,
          did,
          name: didInfo.name || `DID_${did}`,
          dataLength: didInfo.dataLength,
          dataType: didInfo.dataType || 'BINARY',
          sampleValues: didInfo.sampleValues
        }
      })
    }

    for (const [code, dtcInfo] of ecu.discoveredDTCs) {
      await prisma.dTC.create({
        data: {
          jobId,
          ecuName: ecu.name,
          code,
          status: dtcInfo.status,
          statusByte: dtcInfo.statusByte,
          description: dtcInfo.description
        }
      })
    }

    for (const [routineId, routineInfo] of ecu.discoveredRoutines) {
      await prisma.routine.create({
        data: {
          jobId,
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

  const metadataToStore = {
    // Store ALL messages for complete UDS Flow display
    messages: parsedData.messages,
    messagesComplete: true,
    procedures: parsedData.procedures,
    ecuCount: discoveredECUs.size,
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
    traceFileName: traceFile.fileName || traceFile.name,
    traceFilePath: traceFile.path || null, // Store the full path for reparse (log if missing)
    startTime: parsedData.metadata?.startTime,
    endTime: parsedData.metadata?.endTime,
    duration: parsedData.metadata?.duration,
    // Include Jifeline metadata from parser
    vehicleVoltage: parsedData.metadata?.vehicleVoltage,
    connectionInfo: parsedData.metadata?.connectionInfo,
    connectorMetrics: parsedData.metadata?.connectorMetrics,
    ecuChannels: parsedData.metadata?.ecuChannels,
    metadataMessages: parsedData.metadata?.metadataMessages
  }

  console.log(`Storing metadata with traceFilePath: ${metadataToStore.traceFilePath}`)

  await prisma.diagnosticJob.update({
    where: { id: jobId },
    data: {
      messageCount: parsedData.messages.length,
      metadata: metadataToStore
    }
  })

  // Discover and update knowledge base with new data
  // TODO: Implement knowledge discovery
  // console.log(`Running knowledge discovery for job ${jobId}`)
  // try {
  //   await discoverKnowledgeFromJob(jobId)
  //   console.log(`Knowledge discovery completed for job ${jobId}`)
  // } catch (knowledgeError) {
  //   console.error(`Knowledge discovery failed for job ${jobId}:`, knowledgeError)
  // }

  console.log(`Completed processing trace file: ${traceFile.name}`)
}