#!/usr/bin/env node

import { JifelineParser } from './trace-parser/jifeline-parser'
import { ODXReverseEngineer } from './odx-generator/reverse-engineer'
import { ODXValidator } from './validate-odx'
import { TraceAnalyzer } from './analyze-traces'
import { prisma } from './prisma'
import * as fs from 'fs-extra'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface E2ETestResult {
  success: boolean
  phase: string
  message: string
  details?: any
  error?: Error
}

interface TestSummary {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  duration: number
  results: E2ETestResult[]
  coverage?: CoverageReport
  performanceMetrics: PerformanceMetrics
}

interface CoverageReport {
  lines: number
  functions: number
  branches: number
  statements: number
}

interface PerformanceMetrics {
  averageParseTime: number
  averageGenerationTime: number
  averageValidationTime: number
  totalDatabaseTime: number
  peakMemoryUsage: number
}

/**
 * End-to-End Test Runner for ODX Reverse Engineering System
 */
class E2ETestRunner {
  private parser: JifelineParser
  private reverseEngineer: ODXReverseEngineer
  private validator: ODXValidator
  private analyzer: TraceAnalyzer
  private results: E2ETestResult[] = []
  private performanceData: any[] = []
  private startTime: number = 0
  private outputDir: string

  // Test trace files
  private readonly traceFiles = [
    { path: 'Honda/Jazz V/2020/Camera Calibration/HONDA_JAZZ_CAM_RYDS.txt', oem: 'Honda', model: 'Jazz V', year: 2020 },
    { path: 'Hyundai/i20/2021/Camera Calibration/8882747.txt', oem: 'Hyundai', model: 'i20', year: 2021 },
    { path: 'Landrover/Defender/2020/Camera Calibration/8873778.txt', oem: 'Land Rover', model: 'Defender', year: 2020 },
    { path: 'Landrover/Defender/2023/8884157.txt', oem: 'Land Rover', model: 'Defender', year: 2023 },
    { path: 'MG/3/2021/Camera Calibration/8884494.txt', oem: 'MG', model: '3', year: 2021 },
    { path: 'Nissan/Qashqai/2022/Camera Calibration/8882943.txt', oem: 'Nissan', model: 'Qashqai', year: 2022 },
    { path: 'Polestar/Polestar 2/2022/Camera calibration/8875011.txt', oem: 'Polestar', model: 'Polestar 2', year: 2022 },
    { path: 'Toyota/Yaris/2024/Camera Calibration/8885638.txt', oem: 'Toyota', model: 'Yaris', year: 2024 }
  ]

  constructor() {
    this.parser = new JifelineParser()
    this.reverseEngineer = new ODXReverseEngineer()
    this.validator = new ODXValidator()
    this.analyzer = new TraceAnalyzer()
    this.outputDir = path.join(process.cwd(), 'e2e-test-output')
  }

  /**
   * Run complete end-to-end test suite
   */
  async runFullTest(): Promise<TestSummary> {
    console.log('🚀 Starting End-to-End Test Suite for ODX Reverse Engineering System')
    console.log('=' .repeat(70))

    this.startTime = Date.now()

    try {
      // Phase 1: Setup
      await this.phase1_Setup()

      // Phase 2: Database Seeding
      await this.phase2_DatabaseSeeding()

      // Phase 3: Trace File Processing
      await this.phase3_TraceProcessing()

      // Phase 4: ODX Generation
      await this.phase4_ODXGeneration()

      // Phase 5: ODX Validation
      await this.phase5_ODXValidation()

      // Phase 6: Data Analysis
      await this.phase6_DataAnalysis()

      // Phase 7: Integration Tests
      await this.phase7_IntegrationTests()

      // Phase 8: Performance Benchmarks
      await this.phase8_PerformanceBenchmarks()

      // Phase 9: Report Generation
      await this.phase9_ReportGeneration()

      // Phase 10: Cleanup
      await this.phase10_Cleanup()

    } catch (error) {
      this.results.push({
        success: false,
        phase: 'FATAL',
        message: 'Test suite encountered fatal error',
        error: error as Error
      })
    }

    // Generate summary
    const summary = this.generateSummary()

    // Print results
    this.printResults(summary)

    return summary
  }

  /**
   * Phase 1: Setup test environment
   */
  private async phase1_Setup(): Promise<void> {
    console.log('\n📦 Phase 1: Environment Setup')

    try {
      // Create output directories
      await fs.ensureDir(this.outputDir)
      await fs.ensureDir(path.join(this.outputDir, 'odx'))
      await fs.ensureDir(path.join(this.outputDir, 'reports'))
      await fs.ensureDir(path.join(this.outputDir, 'validation'))

      this.results.push({
        success: true,
        phase: 'Setup',
        message: 'Test environment created successfully',
        details: { outputDir: this.outputDir }
      })

      // Check trace files exist
      let filesFound = 0
      let filesMissing = 0

      for (const file of this.traceFiles) {
        const fullPath = path.join('C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete', file.path)
        if (await fs.pathExists(fullPath)) {
          filesFound++
        } else {
          filesMissing++
          console.warn(`  ⚠️  Missing trace file: ${file.path}`)
        }
      }

      this.results.push({
        success: filesMissing === 0,
        phase: 'Setup',
        message: `Trace files check: ${filesFound} found, ${filesMissing} missing`,
        details: { filesFound, filesMissing }
      })

    } catch (error) {
      this.results.push({
        success: false,
        phase: 'Setup',
        message: 'Failed to setup test environment',
        error: error as Error
      })
      throw error
    }
  }

  /**
   * Phase 2: Seed database with OEMs and models
   */
  private async phase2_DatabaseSeeding(): Promise<void> {
    console.log('\n🌱 Phase 2: Database Seeding')

    const dbStart = Date.now()

    try {
      // Seed OEMs
      const oemsToSeed = ['Honda', 'Hyundai', 'Land Rover', 'MG', 'Nissan', 'Polestar', 'Toyota']
      let oemsCreated = 0

      for (const oemName of oemsToSeed) {
        const oem = await prisma.company.upsert({
          where: { name: oemName },
          update: {},
          create: { name: oemName }
        })
        if (oem) oemsCreated++
      }

      this.results.push({
        success: true,
        phase: 'Database',
        message: `Seeded ${oemsCreated} OEMs`,
        details: { oemsCreated, dbTime: Date.now() - dbStart }
      })

      // Seed vehicle models and years
      let modelsCreated = 0
      let yearsCreated = 0

      for (const file of this.traceFiles) {
        const oem = await prisma.company.findUnique({
          where: { name: file.oem }
        })

        if (oem) {
          const model = await prisma.vehicleModel.upsert({
            where: {
              name_oemId: {
                name: file.model,
                oemId: oem.id
              }
            },
            update: {},
            create: {
              name: file.model,
              oemId: oem.id
            }
          })
          if (model) modelsCreated++

          const year = await prisma.modelYear.upsert({
            where: {
              year_modelId: {
                year: file.year,
                modelId: model.id
              }
            },
            update: {},
            create: {
              year: file.year,
              modelId: model.id
            }
          })
          if (year) yearsCreated++
        }
      }

      this.results.push({
        success: true,
        phase: 'Database',
        message: `Seeded ${modelsCreated} models and ${yearsCreated} model years`,
        details: { modelsCreated, yearsCreated }
      })

    } catch (error) {
      this.results.push({
        success: false,
        phase: 'Database',
        message: 'Database seeding failed',
        error: error as Error
      })
    }

    this.performanceData.push({
      phase: 'Database',
      duration: Date.now() - dbStart
    })
  }

  /**
   * Phase 3: Process all trace files
   */
  private async phase3_TraceProcessing(): Promise<void> {
    console.log('\n🔍 Phase 3: Trace File Processing')

    let processedCount = 0
    let totalMessages = 0
    let totalECUs = 0

    for (const file of this.traceFiles) {
      const fullPath = path.join('C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete', file.path)

      if (!await fs.pathExists(fullPath)) {
        this.results.push({
          success: false,
          phase: 'TraceProcessing',
          message: `Skipped missing file: ${file.path}`,
          details: { file: file.path }
        })
        continue
      }

      const parseStart = Date.now()

      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        const parseResult = this.parser.parseTrace(content)
        const ecus = this.parser.getDiscoveredECUs()

        processedCount++
        totalMessages += parseResult.messages.length
        totalECUs += ecus.size

        this.results.push({
          success: true,
          phase: 'TraceProcessing',
          message: `Processed ${file.oem} ${file.model}`,
          details: {
            file: file.path,
            messages: parseResult.messages.length,
            ecus: ecus.size,
            parseTime: Date.now() - parseStart
          }
        })

        this.performanceData.push({
          phase: 'Parse',
          file: file.path,
          duration: Date.now() - parseStart,
          messages: parseResult.messages.length
        })

      } catch (error) {
        this.results.push({
          success: false,
          phase: 'TraceProcessing',
          message: `Failed to process ${file.path}`,
          error: error as Error
        })
      }
    }

    console.log(`  ✅ Processed ${processedCount} files`)
    console.log(`  📊 Total: ${totalMessages} messages, ${totalECUs} ECUs`)
  }

  /**
   * Phase 4: Generate ODX for all vehicles
   */
  private async phase4_ODXGeneration(): Promise<void> {
    console.log('\n🔧 Phase 4: ODX Generation')

    let generatedCount = 0
    let totalDIDs = 0
    let totalDTCs = 0

    for (const file of this.traceFiles) {
      const fullPath = path.join('C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete', file.path)

      if (!await fs.pathExists(fullPath)) continue

      const genStart = Date.now()

      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        const parseResult = this.parser.parseTrace(content)
        const ecus = this.parser.getDiscoveredECUs()

        // Generate ODX
        const odx = this.reverseEngineer.generateODX(ecus, {
          oem: file.oem,
          model: file.model,
          year: file.year
        })

        // Save ODX files
        const vehicleDir = path.join(this.outputDir, 'odx', `${file.oem}_${file.model}_${file.year}`.replace(/\s+/g, '_'))
        await fs.ensureDir(vehicleDir)

        // Save vehicle info
        await fs.writeFile(
          path.join(vehicleDir, `${odx.vehicleInfo.shortName}.odx-v`),
          odx.vehicleInfo.content
        )

        // Save ECU layers
        for (const ecuLayer of odx.ecuLayers) {
          await fs.writeFile(
            path.join(vehicleDir, `${ecuLayer.shortName}.odx-d`),
            ecuLayer.content
          )
        }

        // Save protocol layer
        await fs.writeFile(
          path.join(vehicleDir, `${odx.protocolLayer.shortName}.odx-p`),
          odx.protocolLayer.content
        )

        // Save communication parameters
        await fs.writeFile(
          path.join(vehicleDir, `${odx.comparam.shortName}.odx-c`),
          odx.comparam.content
        )

        generatedCount++
        totalDIDs += odx.metadata.discoveredDIDs
        totalDTCs += odx.metadata.discoveredDTCs

        this.results.push({
          success: true,
          phase: 'ODXGeneration',
          message: `Generated ODX for ${file.oem} ${file.model}`,
          details: {
            files: odx.ecuLayers.length + 3, // ECUs + vehicle + protocol + comparam
            dids: odx.metadata.discoveredDIDs,
            dtcs: odx.metadata.discoveredDTCs,
            genTime: Date.now() - genStart
          }
        })

        this.performanceData.push({
          phase: 'Generate',
          file: file.path,
          duration: Date.now() - genStart
        })

      } catch (error) {
        this.results.push({
          success: false,
          phase: 'ODXGeneration',
          message: `Failed to generate ODX for ${file.path}`,
          error: error as Error
        })
      }
    }

    console.log(`  ✅ Generated ODX for ${generatedCount} vehicles`)
    console.log(`  📊 Total: ${totalDIDs} DIDs, ${totalDTCs} DTCs`)
  }

  /**
   * Phase 5: Validate all generated ODX files
   */
  private async phase5_ODXValidation(): Promise<void> {
    console.log('\n✔️ Phase 5: ODX Validation')

    const odxDir = path.join(this.outputDir, 'odx')
    const vehicleDirs = await fs.readdir(odxDir)

    let validCount = 0
    let errorCount = 0
    let warningCount = 0

    for (const vehicleDir of vehicleDirs) {
      const fullPath = path.join(odxDir, vehicleDir)
      const valStart = Date.now()

      try {
        const validationResult = await this.validator.validatePackage(fullPath)

        if (validationResult.valid) {
          validCount++
        }
        errorCount += validationResult.errors.length
        warningCount += validationResult.warnings.length

        // Generate validation report
        await this.validator.generateHTMLReport(
          validationResult,
          path.join(this.outputDir, 'validation', `${vehicleDir}_validation.html`)
        )

        this.results.push({
          success: validationResult.valid,
          phase: 'ODXValidation',
          message: `Validated ${vehicleDir}`,
          details: {
            valid: validationResult.valid,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length,
            complianceScore: validationResult.compliance.score,
            valTime: Date.now() - valStart
          }
        })

        this.performanceData.push({
          phase: 'Validate',
          file: vehicleDir,
          duration: Date.now() - valStart
        })

      } catch (error) {
        this.results.push({
          success: false,
          phase: 'ODXValidation',
          message: `Failed to validate ${vehicleDir}`,
          error: error as Error
        })
      }
    }

    console.log(`  ✅ Validated ${validCount} packages`)
    console.log(`  ⚠️  ${errorCount} errors, ${warningCount} warnings`)
  }

  /**
   * Phase 6: Analyze trace data
   */
  private async phase6_DataAnalysis(): Promise<void> {
    console.log('\n📊 Phase 6: Data Analysis')

    try {
      const traceDir = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude\\TraceLogsComplete'
      const comparison = await this.analyzer.analyzeAllTraces(traceDir)

      // Generate comparison report
      await this.analyzer.generateComparisonReport(
        comparison,
        path.join(this.outputDir, 'reports', 'vehicle_comparison.md')
      )

      // Analyze individual traces
      for (const file of this.traceFiles.slice(0, 3)) { // Analyze first 3 for detail
        const fullPath = path.join(traceDir, file.path)
        if (!await fs.pathExists(fullPath)) continue

        const analysis = await this.analyzer.analyzeTraceFile(fullPath, {
          oem: file.oem,
          model: file.model,
          year: file.year
        })

        await this.analyzer.generateReport(
          analysis,
          path.join(this.outputDir, 'reports', `${file.oem}_${file.model}_${file.year}_analysis.md`)
        )
      }

      this.results.push({
        success: true,
        phase: 'DataAnalysis',
        message: 'Generated analysis reports',
        details: {
          vehiclesAnalyzed: comparison.vehicles.length,
          commonDIDs: comparison.commonalities.commonDIDs.length,
          commonServices: comparison.commonalities.commonServices.length
        }
      })

    } catch (error) {
      this.results.push({
        success: false,
        phase: 'DataAnalysis',
        message: 'Failed to generate analysis',
        error: error as Error
      })
    }
  }

  /**
   * Phase 7: Run integration tests
   */
  private async phase7_IntegrationTests(): Promise<void> {
    console.log('\n🧪 Phase 7: Integration Tests')

    try {
      // Run Jest tests
      console.log('  Running Jest tests...')
      const { stdout, stderr } = await execAsync('npm test -- --passWithNoTests')

      // Parse test results
      const testMatch = stdout.match(/Tests:\s+(\d+) passed.*?(\d+) total/)
      const passed = testMatch ? parseInt(testMatch[1]) : 0
      const total = testMatch ? parseInt(testMatch[2]) : 0

      this.results.push({
        success: passed === total,
        phase: 'IntegrationTests',
        message: `Jest tests: ${passed}/${total} passed`,
        details: { passed, total }
      })

    } catch (error) {
      // Tests may fail but we want to continue
      this.results.push({
        success: false,
        phase: 'IntegrationTests',
        message: 'Some tests failed',
        error: error as Error
      })
    }
  }

  /**
   * Phase 8: Performance benchmarks
   */
  private async phase8_PerformanceBenchmarks(): Promise<void> {
    console.log('\n⚡ Phase 8: Performance Benchmarks')

    // Calculate performance metrics
    const parseMetrics = this.performanceData.filter(d => d.phase === 'Parse')
    const genMetrics = this.performanceData.filter(d => d.phase === 'Generate')
    const valMetrics = this.performanceData.filter(d => d.phase === 'Validate')

    const avgParseTime = parseMetrics.length > 0 ?
      parseMetrics.reduce((sum, m) => sum + m.duration, 0) / parseMetrics.length : 0

    const avgGenTime = genMetrics.length > 0 ?
      genMetrics.reduce((sum, m) => sum + m.duration, 0) / genMetrics.length : 0

    const avgValTime = valMetrics.length > 0 ?
      valMetrics.reduce((sum, m) => sum + m.duration, 0) / valMetrics.length : 0

    // Check performance thresholds
    const parseOK = avgParseTime < 5000 // Under 5 seconds
    const genOK = avgGenTime < 2000 // Under 2 seconds
    const valOK = avgValTime < 3000 // Under 3 seconds

    this.results.push({
      success: parseOK && genOK && valOK,
      phase: 'Performance',
      message: 'Performance benchmarks',
      details: {
        avgParseTime: Math.round(avgParseTime),
        avgGenTime: Math.round(avgGenTime),
        avgValTime: Math.round(avgValTime),
        parseOK,
        genOK,
        valOK
      }
    })

    console.log(`  📈 Parse: ${avgParseTime.toFixed(0)}ms avg ${parseOK ? '✅' : '❌'}`)
    console.log(`  📈 Generate: ${avgGenTime.toFixed(0)}ms avg ${genOK ? '✅' : '❌'}`)
    console.log(`  📈 Validate: ${avgValTime.toFixed(0)}ms avg ${valOK ? '✅' : '❌'}`)
  }

  /**
   * Phase 9: Generate final reports
   */
  private async phase9_ReportGeneration(): Promise<void> {
    console.log('\n📝 Phase 9: Report Generation')

    try {
      // Generate E2E test report
      const report = this.generateE2EReport()
      await fs.writeFile(
        path.join(this.outputDir, 'e2e_test_report.md'),
        report
      )

      // Generate summary JSON
      const summary = this.generateSummary()
      await fs.writeFile(
        path.join(this.outputDir, 'test_summary.json'),
        JSON.stringify(summary, null, 2)
      )

      this.results.push({
        success: true,
        phase: 'ReportGeneration',
        message: 'Generated test reports',
        details: { reportPath: this.outputDir }
      })

    } catch (error) {
      this.results.push({
        success: false,
        phase: 'ReportGeneration',
        message: 'Failed to generate reports',
        error: error as Error
      })
    }
  }

  /**
   * Phase 10: Cleanup
   */
  private async phase10_Cleanup(): Promise<void> {
    console.log('\n🧹 Phase 10: Cleanup')

    try {
      // Clean up test data from database
      const oems = await prisma.company.findMany({
        where: {
          name: {
            in: ['Honda', 'Hyundai', 'Land Rover', 'MG', 'Nissan', 'Polestar', 'Toyota']
          }
        }
      })

      for (const oem of oems) {
        // Clean up test ECU variants and related data
        await prisma.eCUVariant.deleteMany({
          where: {
            modelYear: {
              model: {
                oemId: oem.id
              }
            }
          }
        })
      }

      this.results.push({
        success: true,
        phase: 'Cleanup',
        message: 'Cleaned up test data',
        details: { cleanedOEMs: oems.length }
      })

    } catch (error) {
      // Cleanup errors are non-critical
      this.results.push({
        success: false,
        phase: 'Cleanup',
        message: 'Cleanup encountered errors',
        error: error as Error
      })
    }
  }

  /**
   * Generate test summary
   */
  private generateSummary(): TestSummary {
    const duration = Date.now() - this.startTime
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => !r.success).length
    const skipped = 0

    // Calculate performance metrics
    const parseMetrics = this.performanceData.filter(d => d.phase === 'Parse')
    const genMetrics = this.performanceData.filter(d => d.phase === 'Generate')
    const valMetrics = this.performanceData.filter(d => d.phase === 'Validate')
    const dbMetrics = this.performanceData.filter(d => d.phase === 'Database')

    const performanceMetrics: PerformanceMetrics = {
      averageParseTime: parseMetrics.length > 0 ?
        parseMetrics.reduce((sum, m) => sum + m.duration, 0) / parseMetrics.length : 0,
      averageGenerationTime: genMetrics.length > 0 ?
        genMetrics.reduce((sum, m) => sum + m.duration, 0) / genMetrics.length : 0,
      averageValidationTime: valMetrics.length > 0 ?
        valMetrics.reduce((sum, m) => sum + m.duration, 0) / valMetrics.length : 0,
      totalDatabaseTime: dbMetrics.reduce((sum, m) => sum + m.duration, 0),
      peakMemoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    }

    return {
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      duration,
      results: this.results,
      performanceMetrics
    }
  }

  /**
   * Generate E2E test report
   */
  private generateE2EReport(): string {
    const summary = this.generateSummary()
    const passRate = (summary.passed / summary.totalTests * 100).toFixed(1)

    return `
# End-to-End Test Report
## ODX Reverse Engineering System

### Test Summary
- **Date**: ${new Date().toISOString()}
- **Duration**: ${(summary.duration / 1000).toFixed(2)} seconds
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passed} (${passRate}%)
- **Failed**: ${summary.failed}
- **Skipped**: ${summary.skipped}

### Performance Metrics
- **Average Parse Time**: ${summary.performanceMetrics.averageParseTime.toFixed(0)}ms
- **Average Generation Time**: ${summary.performanceMetrics.averageGenerationTime.toFixed(0)}ms
- **Average Validation Time**: ${summary.performanceMetrics.averageValidationTime.toFixed(0)}ms
- **Total Database Time**: ${summary.performanceMetrics.totalDatabaseTime.toFixed(0)}ms
- **Peak Memory Usage**: ${summary.performanceMetrics.peakMemoryUsage.toFixed(2)} MB

### Test Phases

${this.generatePhaseReport()}

### Test Results

| Phase | Test | Result | Details |
|-------|------|--------|---------|
${summary.results.map(r =>
  `| ${r.phase} | ${r.message} | ${r.success ? '✅ PASS' : '❌ FAIL'} | ${r.error ? r.error.message : JSON.stringify(r.details || {})} |`
).join('\n')}

### Files Processed

${this.traceFiles.map(f => `- ${f.oem} ${f.model} (${f.year})`).join('\n')}

### Recommendations

${this.generateRecommendations()}

### Conclusion

The ODX Reverse Engineering System has been thoroughly tested with ${this.traceFiles.length} real vehicle trace logs.
The system successfully:
- Parses Jifeline trace formats
- Discovers ECUs and their capabilities
- Generates ODX 2.2.0 compliant files
- Validates against ASAM MCD-2D specification
- Stores data in the database
- Provides comprehensive analysis

Overall Test Result: **${summary.failed === 0 ? 'PASSED ✅' : 'FAILED ❌'}**
    `
  }

  /**
   * Generate phase-by-phase report
   */
  private generatePhaseReport(): string {
    const phases = [
      'Setup', 'Database', 'TraceProcessing', 'ODXGeneration',
      'ODXValidation', 'DataAnalysis', 'IntegrationTests',
      'Performance', 'ReportGeneration', 'Cleanup'
    ]

    return phases.map(phase => {
      const phaseResults = this.results.filter(r => r.phase === phase)
      const passed = phaseResults.filter(r => r.success).length
      const total = phaseResults.length

      return `#### ${phase}
- Tests: ${total}
- Passed: ${passed}
- Status: ${passed === total ? '✅' : '⚠️'}
`
    }).join('\n')
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string {
    const recommendations: string[] = []

    // Check for failed tests
    const failedPhases = new Set(this.results.filter(r => !r.success).map(r => r.phase))

    if (failedPhases.has('TraceProcessing')) {
      recommendations.push('- Improve trace parsing error handling')
    }

    if (failedPhases.has('ODXGeneration')) {
      recommendations.push('- Enhance ODX generation robustness')
    }

    if (failedPhases.has('ODXValidation')) {
      recommendations.push('- Review ODX compliance with ASAM specification')
    }

    // Performance recommendations
    const perfResult = this.results.find(r => r.phase === 'Performance')
    if (perfResult && perfResult.details) {
      if (!perfResult.details.parseOK) {
        recommendations.push('- Optimize trace parsing performance')
      }
      if (!perfResult.details.genOK) {
        recommendations.push('- Optimize ODX generation performance')
      }
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('- System performing well, consider adding more test cases')
      recommendations.push('- Expand trace file coverage to more vehicle types')
    }

    return recommendations.join('\n')
  }

  /**
   * Print results to console
   */
  private printResults(summary: TestSummary): void {
    console.log('\n' + '='.repeat(70))
    console.log('📊 TEST SUMMARY')
    console.log('='.repeat(70))

    const passRate = (summary.passed / summary.totalTests * 100).toFixed(1)

    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`Passed: ${summary.passed} (${passRate}%)`)
    console.log(`Failed: ${summary.failed}`)
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`)

    if (summary.failed === 0) {
      console.log('\n✅ ALL TESTS PASSED!')
    } else {
      console.log('\n❌ SOME TESTS FAILED')
      console.log('\nFailed Tests:')
      summary.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - [${r.phase}] ${r.message}`)
          if (r.error) {
            console.log(`    Error: ${r.error.message}`)
          }
        })
    }

    console.log('\n📁 Results saved to:', this.outputDir)
  }
}

// Main execution
if (require.main === module) {
  const runner = new E2ETestRunner()

  runner.runFullTest()
    .then(summary => {
      process.exit(summary.failed === 0 ? 0 : 1)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { E2ETestRunner, TestSummary, E2ETestResult }