import * as fs from 'fs'
import * as path from 'path'
import { JifelineParser } from './trace-parser/jifeline-parser'
import { ODXReverseEngineer } from './odx-generator/reverse-engineer'

interface TraceFile {
  oem: string
  model: string
  year: number
  filePath: string
  jobType: string
}

interface ProcessingResult {
  file: TraceFile
  success: boolean
  error?: string
  discoveries?: {
    ecus: number
    dids: number
    dtcs: number
    routines: number
  }
  odxPath?: string
}

class TraceProcessor {
  private readonly traceLogsPath = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete'
  private readonly outputPath = 'C:\\Optimotive-dev\\OptiDiagFlow\\opti-diag-flow\\storage\\odx'
  private readonly parser = new JifelineParser()
  private readonly odxGenerator = new ODXReverseEngineer()

  /**
   * Discover all trace files in the directory structure
   */
  discoverTraceFiles(): TraceFile[] {
    const traceFiles: TraceFile[] = []

    // Read OEM directories
    const oemDirs = fs.readdirSync(this.traceLogsPath)
      .filter(dir => fs.statSync(path.join(this.traceLogsPath, dir)).isDirectory())

    for (const oemDir of oemDirs) {
      const oemPath = path.join(this.traceLogsPath, oemDir)
      const oemName = oemDir === 'Landrover' ? 'Land Rover' : oemDir

      // Read model directories
      const modelDirs = fs.readdirSync(oemPath)
        .filter(dir => fs.statSync(path.join(oemPath, dir)).isDirectory())

      for (const modelDir of modelDirs) {
        const modelPath = path.join(oemPath, modelDir)

        // Read year directories
        const yearDirs = fs.readdirSync(modelPath)
          .filter(dir => fs.statSync(path.join(modelPath, dir)).isDirectory())

        for (const yearDir of yearDirs) {
          const yearPath = path.join(modelPath, yearDir)
          const year = parseInt(yearDir)

          if (isNaN(year)) continue

          // Find trace files (either directly in year dir or in subdirs)
          const findTraceFiles = (dirPath: string, jobType: string = 'General'): void => {
            const entries = fs.readdirSync(dirPath)

            for (const entry of entries) {
              const entryPath = path.join(dirPath, entry)
              const stat = fs.statSync(entryPath)

              if (stat.isDirectory()) {
                // Recurse into subdirectory
                findTraceFiles(entryPath, entry)
              } else if (entry.endsWith('.txt')) {
                // Found a trace file
                traceFiles.push({
                  oem: oemName,
                  model: modelDir,
                  year,
                  filePath: entryPath,
                  jobType
                })
              }
            }
          }

          findTraceFiles(yearPath)
        }
      }
    }

    return traceFiles
  }

  /**
   * Process a single trace file
   */
  async processTraceFile(traceFile: TraceFile): Promise<ProcessingResult> {
    console.log(`\nProcessing: ${traceFile.oem} ${traceFile.model} ${traceFile.year}`)
    console.log(`  File: ${path.basename(traceFile.filePath)}`)
    console.log(`  Job Type: ${traceFile.jobType}`)

    try {
      // Read trace file
      const content = fs.readFileSync(traceFile.filePath, 'utf-8')
      console.log(`  File size: ${(content.length / 1024).toFixed(1)} KB`)

      // Parse trace log
      console.log('  Parsing trace log...')
      const parsed = this.parser.parseTrace(content)
      const ecus = this.parser.getDiscoveredECUs()

      console.log(`  Found ${ecus.size} ECUs`)

      // Log ECU details
      for (const [address, ecu] of ecus) {
        console.log(`    - ${ecu.name} (${address}): ${ecu.messageCount} messages`)
        console.log(`      Services: ${Array.from(ecu.discoveredServices).join(', ')}`)
        console.log(`      DIDs: ${ecu.discoveredDIDs.size}, DTCs: ${ecu.discoveredDTCs.size}, Routines: ${ecu.discoveredRoutines.size}`)
      }

      // Generate ODX
      console.log('  Generating ODX...')
      const odx = this.odxGenerator.generateODX(ecus, {
        oem: traceFile.oem,
        model: traceFile.model,
        year: traceFile.year
      })

      // Save ODX files
      const outputDir = path.join(
        this.outputPath,
        traceFile.oem.replace(/\s+/g, '_'),
        traceFile.model.replace(/\s+/g, '_'),
        traceFile.year.toString()
      )

      console.log(`  Saving ODX to: ${outputDir}`)
      this.odxGenerator.saveODXFiles(odx, outputDir)

      return {
        file: traceFile,
        success: true,
        discoveries: {
          ecus: odx.metadata.discoveredECUs,
          dids: odx.metadata.discoveredDIDs,
          dtcs: odx.metadata.discoveredDTCs,
          routines: odx.metadata.discoveredRoutines
        },
        odxPath: outputDir
      }
    } catch (error) {
      console.error(`  ERROR: ${error}`)
      return {
        file: traceFile,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Process all trace files
   */
  async processAll(): Promise<void> {
    console.log('========================================')
    console.log('ODX Reverse Engineering - Batch Processing')
    console.log('========================================')

    // Discover trace files
    console.log('\nDiscovering trace files...')
    const traceFiles = this.discoverTraceFiles()
    console.log(`Found ${traceFiles.length} trace files`)

    // Process each file
    const results: ProcessingResult[] = []

    for (const traceFile of traceFiles) {
      const result = await this.processTraceFile(traceFile)
      results.push(result)
    }

    // Generate summary report
    this.generateSummaryReport(results)
  }

  /**
   * Generate summary report
   */
  private generateSummaryReport(results: ProcessingResult[]): void {
    console.log('\n========================================')
    console.log('PROCESSING COMPLETE - SUMMARY')
    console.log('========================================')

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    console.log(`\nTotal files processed: ${results.length}`)
    console.log(`Successful: ${successful.length}`)
    console.log(`Failed: ${failed.length}`)

    if (successful.length > 0) {
      console.log('\n✓ Successfully processed:')
      for (const result of successful) {
        console.log(`  - ${result.file.oem} ${result.file.model} ${result.file.year}`)
        if (result.discoveries) {
          console.log(`    ECUs: ${result.discoveries.ecus}, DIDs: ${result.discoveries.dids}, ` +
                     `DTCs: ${result.discoveries.dtcs}, Routines: ${result.discoveries.routines}`)
        }
      }
    }

    if (failed.length > 0) {
      console.log('\n✗ Failed to process:')
      for (const result of failed) {
        console.log(`  - ${result.file.oem} ${result.file.model} ${result.file.year}`)
        console.log(`    Error: ${result.error}`)
      }
    }

    // Calculate totals
    let totalECUs = 0
    let totalDIDs = 0
    let totalDTCs = 0
    let totalRoutines = 0

    for (const result of successful) {
      if (result.discoveries) {
        totalECUs += result.discoveries.ecus
        totalDIDs += result.discoveries.dids
        totalDTCs += result.discoveries.dtcs
        totalRoutines += result.discoveries.routines
      }
    }

    console.log('\n========================================')
    console.log('TOTAL DISCOVERIES')
    console.log('========================================')
    console.log(`ECUs:     ${totalECUs}`)
    console.log(`DIDs:     ${totalDIDs}`)
    console.log(`DTCs:     ${totalDTCs}`)
    console.log(`Routines: ${totalRoutines}`)
    console.log('========================================')

    // Save summary to file
    const summaryPath = path.join(this.outputPath, 'batch_processing_summary.json')
    const summary = {
      timestamp: new Date().toISOString(),
      totalFiles: results.length,
      successful: successful.length,
      failed: failed.length,
      discoveries: {
        totalECUs,
        totalDIDs,
        totalDTCs,
        totalRoutines
      },
      results: results.map(r => ({
        oem: r.file.oem,
        model: r.file.model,
        year: r.file.year,
        jobType: r.file.jobType,
        success: r.success,
        error: r.error,
        discoveries: r.discoveries,
        odxPath: r.odxPath
      }))
    }

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8')
    console.log(`\nSummary saved to: ${summaryPath}`)
  }
}

// Run the batch processor
const processor = new TraceProcessor()
processor.processAll()
  .then(() => {
    console.log('\n✓ Batch processing completed successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n✗ Batch processing failed:', error)
    process.exit(1)
  })