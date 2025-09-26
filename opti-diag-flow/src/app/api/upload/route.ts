import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir, unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const jobId = formData.get('jobId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'traces')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // If jobId is provided, it's an edit - delete old trace file
    if (jobId) {
      try {
        // Find the job to get the current file name
        const job = await prisma.diagnosticJob.findUnique({
          where: { id: jobId },
          select: { name: true }
        })

        if (job?.name) {
          // Look for existing trace files that match this job
          const files = await readdir(uploadDir)
          const jobFiles = files.filter(f => f.includes(job.name.replace(/[^a-zA-Z0-9]/g, '_')))

          // Delete old trace files
          for (const oldFile of jobFiles) {
            try {
              await unlink(path.join(uploadDir, oldFile))
              console.log(`Deleted old trace file: ${oldFile}`)
            } catch (err) {
              console.error(`Failed to delete old file ${oldFile}:`, err)
            }
          }
        }
      } catch (error) {
        console.error('Error cleaning up old files:', error)
        // Continue with upload even if cleanup fails
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(7)
    const fileName = `${timestamp}-${randomId}-${file.name}`
    const filePath = path.join(uploadDir, fileName)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Read the file content as string for immediate processing
    const content = buffer.toString('utf-8')

    return NextResponse.json({
      success: true,
      fileName,
      originalName: file.name,
      size: file.size,
      path: filePath,
      content // Return content for immediate use
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}