import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // First try to remove from ECUConfiguration table
    const ecusDeleted = await prisma.eCUConfiguration.deleteMany({
      where: {
        jobId: id,
        ecuName: {
          in: ['ECU_33', 'ECU_DF'] // Functional broadcast ECUs
        }
      }
    })

    // Also clean up metadata if ECU_33 exists there
    const job = await prisma.diagnosticJob.findUnique({
      where: { id },
      select: { metadata: true }
    })

    if (job && job.metadata) {
      const metadata = job.metadata as any
      let metadataModified = false

      // Remove ECU_33 from ECUs array in metadata
      if (metadata.ecus && Array.isArray(metadata.ecus)) {
        const originalLength = metadata.ecus.length
        metadata.ecus = metadata.ecus.filter((ecu: any) =>
          ecu.address !== '33' &&
          ecu.name !== 'ECU_33' &&
          ecu.address !== 'DF' &&
          ecu.name !== 'ECU_DF'
        )
        if (metadata.ecus.length < originalLength) {
          metadataModified = true
        }
      }

      // Also filter messages if needed (remove messages to/from ECU_33)
      if (metadata.messages && Array.isArray(metadata.messages)) {
        const originalLength = metadata.messages.length
        metadata.messages = metadata.messages.filter((msg: any) => {
          // Keep messages unless they're from/to ECU_33
          const sourceAddr = msg.sourceAddress || msg.source
          const targetAddr = msg.targetAddress || msg.target
          return sourceAddr !== '33' && targetAddr !== '33' &&
                 sourceAddr !== 'ECU_33' && targetAddr !== 'ECU_33'
        })
        if (metadata.messages.length < originalLength) {
          metadataModified = true
        }
      }

      // Update metadata if modified
      if (metadataModified) {
        await prisma.diagnosticJob.update({
          where: { id },
          data: { metadata }
        })
      }

      return NextResponse.json({
        success: true,
        message: `Cleaned up incorrect ECU entries`,
        details: {
          ecuConfigurationDeleted: ecusDeleted.count,
          metadataModified
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${ecusDeleted.count} incorrect ECU entries`,
      details: {
        ecuConfigurationDeleted: ecusDeleted.count,
        metadataModified: false
      }
    })
  } catch (error) {
    console.error('Error cleaning up ECUs:', error)
    return NextResponse.json(
      { error: 'Failed to clean up incorrect ECUs' },
      { status: 500 }
    )
  }
}