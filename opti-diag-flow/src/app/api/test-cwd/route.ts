import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const cwd = process.cwd()
  const uploadsDir = path.join(cwd, 'uploads', 'traces')

  const result = {
    cwd,
    uploadsDir,
    uploadsExists: fs.existsSync(uploadsDir),
    files: []
  }

  if (fs.existsSync(uploadsDir)) {
    result.files = fs.readdirSync(uploadsDir)
  }

  // Also try alternative path if running from opti-diag-flow subdirectory
  const altUploadsDir = path.join(cwd, 'opti-diag-flow', 'uploads', 'traces')
  const altResult = {
    altUploadsDir,
    altExists: fs.existsSync(altUploadsDir),
    altFiles: []
  }

  if (fs.existsSync(altUploadsDir)) {
    altResult.altFiles = fs.readdirSync(altUploadsDir)
  }

  return NextResponse.json({ ...result, ...altResult })
}