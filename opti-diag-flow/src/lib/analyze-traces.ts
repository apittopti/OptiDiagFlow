import { JifelineParser, DiscoveredECU } from './trace-parser/jifeline-parser'
import { ODXReverseEngineer } from './odx-generator/reverse-engineer'
import * as fs from 'fs-extra'
import * as path from 'path'
import { table } from 'console'

export interface TraceAnalysisResult {
  file: string
  oem: string
  model: string
  year: number
  statistics: TraceStatistics
  ecus: ECUAnalysis[]
  commonPatterns: CommonPatterns
  dataQuality: DataQuality
}

export interface TraceStatistics {
  totalMessages: number
  uniqueECUs: number
  totalDIDs: number
  totalDTCs: number
  totalRoutines: number
  totalServices: Set<string>
  sessionTypes: Set<string>
  securityLevels: Set<string>
  protocolUsed: string
  duration: string
  messagesPerSecond: number
  fileSize: number
}

export interface ECUAnalysis {
  address: string
  name: string
  protocol: string
  messageCount: number
  messagePercentage: number
  services: string[]
  didCount: number
  dtcCount: number
  routineCount: number
  sessionTypes: string[]
  securityLevels: string[]
  topDIDs: { did: string; name: string; count: number }[]
  dataCompleteness: number // 0-100%
}

export interface CommonPatterns {
  mostCommonServices: { service: string; name: string; count: number; ecus: string[] }[]
  mostCommonDIDs: { did: string; name: string; count: number; ecus: string[] }[]
  sharedDIDs: { did: string; name: string; ecus: string[] }[]
  communicationPatterns: { pattern: string; count: number; description: string }[]
  sessionSequences: { sequence: string[]; count: number }[]
}

export interface DataQuality {
  overallScore: number // 0-100
  completeness: number // 0-100
  consistency: number // 0-100
  coverage: {
    services: number // percentage of known UDS services found
    standardDIDs: number // percentage of standard DIDs found
    ecuTypes: number // percentage of expected ECU types found
  }
  issues: QualityIssue[]
  recommendations: string[]
}

export interface QualityIssue {
  severity: 'low' | 'medium' | 'high'
  type: string
  description: string
  affectedECUs: string[]
}

export interface ComparisonReport {
  vehicles: VehicleSummary[]
  commonalities: CrossVehiclePatterns
  differences: VehicleDifferences
  manufacturerPatterns: ManufacturerPattern[]
}

export interface VehicleSummary {
  oem: string
  model: string
  year: number
  ecuCount: number
  didCount: number
  dtcCount: number
  protocol: string
  uniqueFeatures: string[]
}

export interface CrossVehiclePatterns {
  commonDIDs: { did: string; name: string; vehicles: number; percentage: number }[]
  commonServices: { service: string; name: string; vehicles: number; percentage: number }[]
  commonECUTypes: { type: string; vehicles: number; percentage: number }[]
  protocolDistribution: { protocol: string; count: number; percentage: number }[]
}

export interface VehicleDifferences {
  uniqueDIDsByVehicle: Map<string, { did: string; name: string }[]>
  uniqueServicesByVehicle: Map<string, string[]>
  protocolVariations: { vehicle: string; protocol: string }[]
  ecuCountVariation: { min: number; max: number; average: number; stdDev: number }
}

export interface ManufacturerPattern {
  manufacturer: string
  characteristics: {
    preferredProtocol: string
    averageECUCount: number
    commonDIDs: string[]
    commonServices: string[]
    addressingScheme: string
    securityApproach: string
  }
}

/**
 * Comprehensive trace file analysis tool
 */
export class TraceAnalyzer {
  private parser: JifelineParser
  private reverseEngineer: ODXReverseEngineer

  // Known UDS services
  private readonly UDS_SERVICES = new Map([
    ['10', 'Diagnostic Session Control'],
    ['11', 'ECU Reset'],
    ['14', 'Clear Diagnostic Information'],
    ['19', 'Read DTC Information'],
    ['22', 'Read Data By Identifier'],
    ['23', 'Read Memory By Address'],
    ['24', 'Read Scaling Data By Identifier'],
    ['27', 'Security Access'],
    ['28', 'Communication Control'],
    ['2A', 'Read Data By Periodic Identifier'],
    ['2C', 'Dynamically Define Data Identifier'],
    ['2E', 'Write Data By Identifier'],
    ['2F', 'Input Output Control By Identifier'],
    ['31', 'Routine Control'],
    ['34', 'Request Download'],
    ['35', 'Request Upload'],
    ['36', 'Transfer Data'],
    ['37', 'Request Transfer Exit'],
    ['3D', 'Write Memory By Address'],
    ['3E', 'Tester Present'],
    ['84', 'Secured Data Transmission'],
    ['85', 'Control DTC Setting'],
    ['86', 'Response On Event'],
    ['87', 'Link Control']
  ])

  // Standard DIDs
  private readonly STANDARD_DIDS = new Map([
    ['F186', 'Active Diagnostic Session'],
    ['F187', 'Manufacturer Spare Part Number'],
    ['F188', 'Manufacturer ECU Software Number'],
    ['F189', 'Manufacturer ECU Software Version'],
    ['F18C', 'ECU Serial Number'],
    ['F190', 'VIN'],
    ['F191', 'Vehicle Manufacturer ECU Hardware Number'],
    ['F192', 'System Supplier ECU Hardware Number'],
    ['F193', 'System Supplier ECU Hardware Version'],
    ['F194', 'System Supplier ECU Software Number'],
    ['F195', 'System Supplier ECU Software Version'],
    ['F197', 'System Name or Engine Type'],
    ['F198', 'Repair Shop Code'],
    ['F199', 'Programming Date'],
    ['F19D', 'Calibration Repair Shop Code'],
    ['F19E', 'Calibration Equipment Software Number']
  ])

  // Expected ECU types
  private readonly EXPECTED_ECU_TYPES = [
    'Engine', 'Transmission', 'ABS', 'Airbag', 'BCM', 'Gateway',
    'Instrument', 'HVAC', 'Camera', 'Radar', 'Battery', 'Charger'
  ]

  constructor() {
    this.parser = new JifelineParser()
    this.reverseEngineer = new ODXReverseEngineer()
  }

  /**
   * Analyze a single trace file
   */
  async analyzeTraceFile(
    filePath: string,
    vehicleInfo: { oem: string; model: string; year: number }
  ): Promise<TraceAnalysisResult> {
    // Read and parse file
    const content = await fs.readFile(filePath, 'utf-8')
    const fileSize = Buffer.byteLength(content)

    const parseResult = this.parser.parseTrace(content)
    const ecus = this.parser.getDiscoveredECUs()

    // Calculate statistics
    const statistics = this.calculateStatistics(parseResult, ecus, fileSize)

    // Analyze each ECU
    const ecuAnalyses = this.analyzeECUs(ecus, parseResult.messages.length)

    // Find common patterns
    const commonPatterns = this.findCommonPatterns(ecus)

    // Assess data quality
    const dataQuality = this.assessDataQuality(ecus, parseResult)

    return {
      file: path.basename(filePath),
      oem: vehicleInfo.oem,
      model: vehicleInfo.model,
      year: vehicleInfo.year,
      statistics,
      ecus: ecuAnalyses,
      commonPatterns,
      dataQuality
    }
  }

  /**
   * Analyze all trace files in a directory
   */
  async analyzeAllTraces(traceDirectory: string): Promise<ComparisonReport> {
    const traceFiles = [
      { path: 'Honda/Jazz V/2020/Camera Calibration/HONDA_JAZZ_CAM_RYDS.txt', oem: 'Honda', model: 'Jazz V', year: 2020 },
      { path: 'Hyundai/i20/2021/Camera Calibration/8882747.txt', oem: 'Hyundai', model: 'i20', year: 2021 },
      { path: 'Landrover/Defender/2020/Camera Calibration/8873778.txt', oem: 'Land Rover', model: 'Defender', year: 2020 },
      { path: 'Landrover/Defender/2023/8884157.txt', oem: 'Land Rover', model: 'Defender', year: 2023 },
      { path: 'MG/3/2021/Camera Calibration/8884494.txt', oem: 'MG', model: '3', year: 2021 },
      { path: 'Nissan/Qashqai/2022/Camera Calibration/8882943.txt', oem: 'Nissan', model: 'Qashqai', year: 2022 },
      { path: 'Polestar/Polestar 2/2022/Camera calibration/8875011.txt', oem: 'Polestar', model: 'Polestar 2', year: 2022 },
      { path: 'Toyota/Yaris/2024/Camera Calibration/8885638.txt', oem: 'Toyota', model: 'Yaris', year: 2024 }
    ]

    const analyses: TraceAnalysisResult[] = []

    // Analyze each file
    for (const file of traceFiles) {
      const fullPath = path.join(traceDirectory, file.path)
      if (await fs.pathExists(fullPath)) {
        const analysis = await this.analyzeTraceFile(fullPath, {
          oem: file.oem,
          model: file.model,
          year: file.year
        })
        analyses.push(analysis)
      }
    }

    // Generate comparison report
    return this.generateComparisonReport(analyses)
  }

  /**
   * Calculate statistics from parsed trace
   */
  private calculateStatistics(
    parseResult: any,
    ecus: Map<string, DiscoveredECU>,
    fileSize: number
  ): TraceStatistics {
    const allServices = new Set<string>()
    const allSessionTypes = new Set<string>()
    const allSecurityLevels = new Set<string>()
    let totalDIDs = 0
    let totalDTCs = 0
    let totalRoutines = 0

    for (const ecu of ecus.values()) {
      ecu.discoveredServices.forEach(s => allServices.add(s))
      ecu.sessionTypes.forEach(s => allSessionTypes.add(s))
      ecu.securityLevels.forEach(s => allSecurityLevels.add(s))
      totalDIDs += ecu.discoveredDIDs.size
      totalDTCs += ecu.discoveredDTCs.size
      totalRoutines += ecu.discoveredRoutines.size
    }

    // Calculate duration
    const startTime = parseResult.metadata?.startTime || '00:00:00.000'
    const endTime = parseResult.metadata?.endTime || '00:00:00.000'
    const duration = this.calculateDuration(startTime, endTime)
    const durationSeconds = this.parseDurationToSeconds(duration)
    const messagesPerSecond = durationSeconds > 0 ?
      Math.round(parseResult.messages.length / durationSeconds) : 0

    return {
      totalMessages: parseResult.messages.length,
      uniqueECUs: ecus.size,
      totalDIDs,
      totalDTCs,
      totalRoutines,
      totalServices: allServices,
      sessionTypes: allSessionTypes,
      securityLevels: allSecurityLevels,
      protocolUsed: parseResult.metadata?.protocol || 'Unknown',
      duration,
      messagesPerSecond,
      fileSize
    }
  }

  /**
   * Analyze individual ECUs
   */
  private analyzeECUs(ecus: Map<string, DiscoveredECU>, totalMessages: number): ECUAnalysis[] {
    const analyses: ECUAnalysis[] = []

    for (const [address, ecu] of ecus) {
      // Get top DIDs by frequency (we'll approximate by assuming each is used once)
      const topDIDs = Array.from(ecu.discoveredDIDs.entries())
        .slice(0, 10)
        .map(([did, info]) => ({
          did,
          name: info.name || `Unknown_${did}`,
          count: info.sampleValues.length
        }))

      // Calculate data completeness
      const completeness = this.calculateECUCompleteness(ecu)

      analyses.push({
        address,
        name: ecu.name,
        protocol: ecu.protocol,
        messageCount: ecu.messageCount,
        messagePercentage: (ecu.messageCount / totalMessages) * 100,
        services: Array.from(ecu.discoveredServices),
        didCount: ecu.discoveredDIDs.size,
        dtcCount: ecu.discoveredDTCs.size,
        routineCount: ecu.discoveredRoutines.size,
        sessionTypes: Array.from(ecu.sessionTypes),
        securityLevels: Array.from(ecu.securityLevels),
        topDIDs,
        dataCompleteness: completeness
      })
    }

    // Sort by message count
    analyses.sort((a, b) => b.messageCount - a.messageCount)

    return analyses
  }

  /**
   * Find common patterns across ECUs
   */
  private findCommonPatterns(ecus: Map<string, DiscoveredECU>): CommonPatterns {
    // Track service usage
    const serviceUsage = new Map<string, { name: string; count: number; ecus: string[] }>()
    const didUsage = new Map<string, { name: string; count: number; ecus: string[] }>()

    for (const [address, ecu] of ecus) {
      // Track services
      for (const service of ecu.discoveredServices) {
        if (!serviceUsage.has(service)) {
          serviceUsage.set(service, {
            name: this.UDS_SERVICES.get(service) || `Service_0x${service}`,
            count: 0,
            ecus: []
          })
        }
        const svc = serviceUsage.get(service)!
        svc.count++
        svc.ecus.push(ecu.name)
      }

      // Track DIDs
      for (const [did, info] of ecu.discoveredDIDs) {
        if (!didUsage.has(did)) {
          didUsage.set(did, {
            name: info.name || `DID_${did}`,
            count: 0,
            ecus: []
          })
        }
        const didInfo = didUsage.get(did)!
        didInfo.count++
        didInfo.ecus.push(ecu.name)
      }
    }

    // Find most common services
    const mostCommonServices = Array.from(serviceUsage.entries())
      .map(([service, data]) => ({ service, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Find most common DIDs
    const mostCommonDIDs = Array.from(didUsage.entries())
      .map(([did, data]) => ({ did, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Find shared DIDs (present in multiple ECUs)
    const sharedDIDs = Array.from(didUsage.entries())
      .filter(([_, data]) => data.ecus.length > 1)
      .map(([did, data]) => ({ did, name: data.name, ecus: data.ecus }))

    // Identify communication patterns
    const communicationPatterns = this.identifyCommunicationPatterns(ecus)

    // Find session sequences
    const sessionSequences = this.findSessionSequences(ecus)

    return {
      mostCommonServices,
      mostCommonDIDs,
      sharedDIDs,
      communicationPatterns,
      sessionSequences
    }
  }

  /**
   * Identify communication patterns
   */
  private identifyCommunicationPatterns(ecus: Map<string, DiscoveredECU>): { pattern: string; count: number; description: string }[] {
    const patterns: { pattern: string; count: number; description: string }[] = []

    // Pattern 1: Session + Security sequence
    let sessionSecurityCount = 0
    for (const ecu of ecus.values()) {
      if (ecu.discoveredServices.has('10') && ecu.discoveredServices.has('27')) {
        sessionSecurityCount++
      }
    }
    if (sessionSecurityCount > 0) {
      patterns.push({
        pattern: 'SESSION_SECURITY',
        count: sessionSecurityCount,
        description: 'ECUs using session control followed by security access'
      })
    }

    // Pattern 2: Read-only diagnostics
    let readOnlyCount = 0
    for (const ecu of ecus.values()) {
      const hasRead = ecu.discoveredServices.has('22') || ecu.discoveredServices.has('19')
      const hasWrite = ecu.discoveredServices.has('2E') || ecu.discoveredServices.has('31')
      if (hasRead && !hasWrite) {
        readOnlyCount++
      }
    }
    if (readOnlyCount > 0) {
      patterns.push({
        pattern: 'READ_ONLY',
        count: readOnlyCount,
        description: 'ECUs with read-only diagnostic capabilities'
      })
    }

    // Pattern 3: Full diagnostic capability
    let fullDiagCount = 0
    for (const ecu of ecus.values()) {
      if (ecu.discoveredServices.size >= 5) {
        fullDiagCount++
      }
    }
    if (fullDiagCount > 0) {
      patterns.push({
        pattern: 'FULL_DIAG',
        count: fullDiagCount,
        description: 'ECUs with comprehensive diagnostic capabilities (5+ services)'
      })
    }

    // Pattern 4: Routine control capability
    let routineCount = 0
    for (const ecu of ecus.values()) {
      if (ecu.discoveredServices.has('31')) {
        routineCount++
      }
    }
    if (routineCount > 0) {
      patterns.push({
        pattern: 'ROUTINE_CONTROL',
        count: routineCount,
        description: 'ECUs supporting routine control (calibration, tests)'
      })
    }

    return patterns
  }

  /**
   * Find common session sequences
   */
  private findSessionSequences(ecus: Map<string, DiscoveredECU>): { sequence: string[]; count: number }[] {
    const sequences: { sequence: string[]; count: number }[] = []

    // Common sequence 1: Default -> Extended
    let defaultExtendedCount = 0
    for (const ecu of ecus.values()) {
      if (ecu.sessionTypes.has('01') && ecu.sessionTypes.has('03')) {
        defaultExtendedCount++
      }
    }
    if (defaultExtendedCount > 0) {
      sequences.push({
        sequence: ['Default (01)', 'Extended (03)'],
        count: defaultExtendedCount
      })
    }

    // Common sequence 2: Default -> Programming
    let defaultProgrammingCount = 0
    for (const ecu of ecus.values()) {
      if (ecu.sessionTypes.has('01') && ecu.sessionTypes.has('02')) {
        defaultProgrammingCount++
      }
    }
    if (defaultProgrammingCount > 0) {
      sequences.push({
        sequence: ['Default (01)', 'Programming (02)'],
        count: defaultProgrammingCount
      })
    }

    return sequences
  }

  /**
   * Assess data quality
   */
  private assessDataQuality(ecus: Map<string, DiscoveredECU>, parseResult: any): DataQuality {
    const issues: QualityIssue[] = []
    const recommendations: string[] = []

    // Check for ECUs with low message counts
    for (const [address, ecu] of ecus) {
      if (ecu.messageCount < 10) {
        issues.push({
          severity: 'low',
          type: 'LOW_MESSAGE_COUNT',
          description: `ECU ${ecu.name} has only ${ecu.messageCount} messages`,
          affectedECUs: [ecu.name]
        })
      }
    }

    // Check for ECUs without DIDs
    for (const [address, ecu] of ecus) {
      if (ecu.discoveredDIDs.size === 0) {
        issues.push({
          severity: 'medium',
          type: 'NO_DIDS',
          description: `ECU ${ecu.name} has no discovered DIDs`,
          affectedECUs: [ecu.name]
        })
        recommendations.push(`Consider reading standard DIDs from ${ecu.name}`)
      }
    }

    // Check for missing standard services
    const hasSessionControl = Array.from(ecus.values()).some(e => e.discoveredServices.has('10'))
    const hasTesterPresent = Array.from(ecus.values()).some(e => e.discoveredServices.has('3E'))

    if (!hasSessionControl) {
      issues.push({
        severity: 'high',
        type: 'MISSING_STANDARD_SERVICE',
        description: 'No ECU implements Diagnostic Session Control (0x10)',
        affectedECUs: Array.from(ecus.values()).map(e => e.name)
      })
      recommendations.push('Implement Diagnostic Session Control for proper session management')
    }

    if (!hasTesterPresent) {
      issues.push({
        severity: 'medium',
        type: 'MISSING_STANDARD_SERVICE',
        description: 'No ECU implements Tester Present (0x3E)',
        affectedECUs: Array.from(ecus.values()).map(e => e.name)
      })
      recommendations.push('Consider implementing Tester Present to maintain diagnostic sessions')
    }

    // Calculate coverage scores
    const serviceCoverage = this.calculateServiceCoverage(ecus)
    const didCoverage = this.calculateDIDCoverage(ecus)
    const ecuTypeCoverage = this.calculateECUTypeCoverage(ecus)

    // Calculate overall quality scores
    const completeness = this.calculateCompleteness(ecus, parseResult)
    const consistency = this.calculateConsistency(ecus)
    const overallScore = (completeness + consistency + serviceCoverage + didCoverage + ecuTypeCoverage) / 5

    // Add recommendations based on scores
    if (serviceCoverage < 50) {
      recommendations.push('Expand diagnostic service coverage to include more UDS services')
    }
    if (didCoverage < 30) {
      recommendations.push('Read more standard DIDs for better vehicle information coverage')
    }
    if (ecuTypeCoverage < 40) {
      recommendations.push('Include more ECU types in diagnostic sessions')
    }

    return {
      overallScore,
      completeness,
      consistency,
      coverage: {
        services: serviceCoverage,
        standardDIDs: didCoverage,
        ecuTypes: ecuTypeCoverage
      },
      issues,
      recommendations
    }
  }

  /**
   * Calculate ECU data completeness
   */
  private calculateECUCompleteness(ecu: DiscoveredECU): number {
    let score = 0
    const weights = {
      services: 30,
      dids: 30,
      dtcs: 10,
      routines: 10,
      sessions: 10,
      security: 10
    }

    // Services score (at least 3 expected)
    score += Math.min((ecu.discoveredServices.size / 3) * weights.services, weights.services)

    // DIDs score (at least 5 expected)
    score += Math.min((ecu.discoveredDIDs.size / 5) * weights.dids, weights.dids)

    // DTCs score (optional)
    if (ecu.discoveredDTCs.size > 0) score += weights.dtcs

    // Routines score (optional)
    if (ecu.discoveredRoutines.size > 0) score += weights.routines

    // Sessions score
    if (ecu.sessionTypes.size > 0) score += weights.sessions

    // Security score
    if (ecu.securityLevels.size > 0) score += weights.security

    return Math.round(score)
  }

  /**
   * Calculate service coverage
   */
  private calculateServiceCoverage(ecus: Map<string, DiscoveredECU>): number {
    const allServices = new Set<string>()
    for (const ecu of ecus.values()) {
      ecu.discoveredServices.forEach(s => allServices.add(s))
    }

    const knownServicesFound = Array.from(allServices).filter(s => this.UDS_SERVICES.has(s)).length
    const totalKnownServices = this.UDS_SERVICES.size

    return Math.round((knownServicesFound / totalKnownServices) * 100)
  }

  /**
   * Calculate DID coverage
   */
  private calculateDIDCoverage(ecus: Map<string, DiscoveredECU>): number {
    const allDIDs = new Set<string>()
    for (const ecu of ecus.values()) {
      ecu.discoveredDIDs.forEach((_, did) => allDIDs.add(did))
    }

    const standardDIDsFound = Array.from(allDIDs).filter(d => this.STANDARD_DIDS.has(d)).length
    const totalStandardDIDs = this.STANDARD_DIDS.size

    return Math.round((standardDIDsFound / totalStandardDIDs) * 100)
  }

  /**
   * Calculate ECU type coverage
   */
  private calculateECUTypeCoverage(ecus: Map<string, DiscoveredECU>): number {
    const foundTypes = new Set<string>()

    for (const ecu of ecus.values()) {
      for (const expectedType of this.EXPECTED_ECU_TYPES) {
        if (ecu.name.includes(expectedType)) {
          foundTypes.add(expectedType)
        }
      }
    }

    return Math.round((foundTypes.size / this.EXPECTED_ECU_TYPES.length) * 100)
  }

  /**
   * Calculate overall completeness
   */
  private calculateCompleteness(ecus: Map<string, DiscoveredECU>, parseResult: any): number {
    let score = 0
    const checks = 5

    // Check 1: Has messages
    if (parseResult.messages.length > 0) score += 20

    // Check 2: Has multiple ECUs
    if (ecus.size > 1) score += 20

    // Check 3: Has DIDs
    const hasDIDs = Array.from(ecus.values()).some(e => e.discoveredDIDs.size > 0)
    if (hasDIDs) score += 20

    // Check 4: Has services
    const hasServices = Array.from(ecus.values()).some(e => e.discoveredServices.size > 0)
    if (hasServices) score += 20

    // Check 5: Has metadata
    if (parseResult.metadata && parseResult.metadata.protocol) score += 20

    return score
  }

  /**
   * Calculate data consistency
   */
  private calculateConsistency(ecus: Map<string, DiscoveredECU>): number {
    let score = 100
    const penalties = []

    // Check for protocol consistency
    const protocols = new Set(Array.from(ecus.values()).map(e => e.protocol))
    if (protocols.size > 1) {
      penalties.push(10) // Mixed protocols
    }

    // Check for addressing consistency
    const addresses = Array.from(ecus.keys())
    const hasConsistentAddressing = addresses.every(a => a.length === addresses[0].length)
    if (!hasConsistentAddressing) {
      penalties.push(5) // Inconsistent address lengths
    }

    // Apply penalties
    for (const penalty of penalties) {
      score -= penalty
    }

    return Math.max(0, score)
  }

  /**
   * Generate comparison report across all vehicles
   */
  private generateComparisonReport(analyses: TraceAnalysisResult[]): ComparisonReport {
    // Create vehicle summaries
    const vehicles: VehicleSummary[] = analyses.map(a => ({
      oem: a.oem,
      model: a.model,
      year: a.year,
      ecuCount: a.statistics.uniqueECUs,
      didCount: a.statistics.totalDIDs,
      dtcCount: a.statistics.totalDTCs,
      protocol: a.statistics.protocolUsed,
      uniqueFeatures: this.identifyUniqueFeatures(a)
    }))

    // Find commonalities
    const commonalities = this.findCrossVehiclePatterns(analyses)

    // Find differences
    const differences = this.findVehicleDifferences(analyses)

    // Identify manufacturer patterns
    const manufacturerPatterns = this.identifyManufacturerPatterns(analyses)

    return {
      vehicles,
      commonalities,
      differences,
      manufacturerPatterns
    }
  }

  /**
   * Identify unique features of a vehicle
   */
  private identifyUniqueFeatures(analysis: TraceAnalysisResult): string[] {
    const features: string[] = []

    // Check for specific capabilities
    if (analysis.statistics.totalRoutines > 5) {
      features.push('Advanced routine control')
    }

    if (analysis.statistics.securityLevels.size > 2) {
      features.push('Multi-level security')
    }

    if (analysis.statistics.totalDTCs > 50) {
      features.push('Comprehensive DTC coverage')
    }

    if (analysis.ecus.some(e => e.name.includes('Camera'))) {
      features.push('Camera calibration support')
    }

    if (analysis.ecus.some(e => e.name.includes('Battery') || e.name.includes('Inverter'))) {
      features.push('Electric/Hybrid support')
    }

    return features
  }

  /**
   * Find patterns across all vehicles
   */
  private findCrossVehiclePatterns(analyses: TraceAnalysisResult[]): CrossVehiclePatterns {
    // Track DIDs across vehicles
    const didAcrossVehicles = new Map<string, Set<string>>()
    const serviceAcrossVehicles = new Map<string, Set<string>>()
    const ecuTypesAcrossVehicles = new Map<string, Set<string>>()
    const protocolCount = new Map<string, number>()

    for (const analysis of analyses) {
      const vehicleId = `${analysis.oem}_${analysis.model}_${analysis.year}`

      // Track DIDs
      for (const ecu of analysis.ecus) {
        for (const did of ecu.topDIDs) {
          if (!didAcrossVehicles.has(did.did)) {
            didAcrossVehicles.set(did.did, new Set())
          }
          didAcrossVehicles.get(did.did)!.add(vehicleId)
        }
      }

      // Track services
      for (const service of analysis.statistics.totalServices) {
        if (!serviceAcrossVehicles.has(service)) {
          serviceAcrossVehicles.set(service, new Set())
        }
        serviceAcrossVehicles.get(service)!.add(vehicleId)
      }

      // Track ECU types
      for (const ecu of analysis.ecus) {
        const ecuType = this.extractECUType(ecu.name)
        if (ecuType) {
          if (!ecuTypesAcrossVehicles.has(ecuType)) {
            ecuTypesAcrossVehicles.set(ecuType, new Set())
          }
          ecuTypesAcrossVehicles.get(ecuType)!.add(vehicleId)
        }
      }

      // Track protocols
      protocolCount.set(analysis.statistics.protocolUsed,
        (protocolCount.get(analysis.statistics.protocolUsed) || 0) + 1)
    }

    const totalVehicles = analyses.length

    // Calculate common DIDs
    const commonDIDs = Array.from(didAcrossVehicles.entries())
      .map(([did, vehicles]) => ({
        did,
        name: this.STANDARD_DIDS.get(did) || `DID_${did}`,
        vehicles: vehicles.size,
        percentage: (vehicles.size / totalVehicles) * 100
      }))
      .filter(d => d.vehicles > 1)
      .sort((a, b) => b.vehicles - a.vehicles)

    // Calculate common services
    const commonServices = Array.from(serviceAcrossVehicles.entries())
      .map(([service, vehicles]) => ({
        service,
        name: this.UDS_SERVICES.get(service) || `Service_0x${service}`,
        vehicles: vehicles.size,
        percentage: (vehicles.size / totalVehicles) * 100
      }))
      .filter(s => s.vehicles > 1)
      .sort((a, b) => b.vehicles - a.vehicles)

    // Calculate common ECU types
    const commonECUTypes = Array.from(ecuTypesAcrossVehicles.entries())
      .map(([type, vehicles]) => ({
        type,
        vehicles: vehicles.size,
        percentage: (vehicles.size / totalVehicles) * 100
      }))
      .sort((a, b) => b.vehicles - a.vehicles)

    // Calculate protocol distribution
    const protocolDistribution = Array.from(protocolCount.entries())
      .map(([protocol, count]) => ({
        protocol,
        count,
        percentage: (count / totalVehicles) * 100
      }))
      .sort((a, b) => b.count - a.count)

    return {
      commonDIDs,
      commonServices,
      commonECUTypes,
      protocolDistribution
    }
  }

  /**
   * Find differences between vehicles
   */
  private findVehicleDifferences(analyses: TraceAnalysisResult[]): VehicleDifferences {
    const uniqueDIDsByVehicle = new Map<string, { did: string; name: string }[]>()
    const uniqueServicesByVehicle = new Map<string, string[]>()
    const protocolVariations: { vehicle: string; protocol: string }[] = []

    // Track all DIDs and services across all vehicles
    const allDIDs = new Set<string>()
    const allServices = new Set<string>()

    for (const analysis of analyses) {
      for (const ecu of analysis.ecus) {
        ecu.topDIDs.forEach(d => allDIDs.add(d.did))
        ecu.services.forEach(s => allServices.add(s))
      }
    }

    // Find unique elements per vehicle
    for (const analysis of analyses) {
      const vehicleId = `${analysis.oem} ${analysis.model} ${analysis.year}`
      const vehicleDIDs = new Set<string>()
      const vehicleServices = new Set<string>()

      for (const ecu of analysis.ecus) {
        ecu.topDIDs.forEach(d => vehicleDIDs.add(d.did))
        ecu.services.forEach(s => vehicleServices.add(s))
      }

      // Find DIDs unique to this vehicle
      const uniqueDIDs: { did: string; name: string }[] = []
      for (const did of vehicleDIDs) {
        let isUnique = true
        for (const other of analyses) {
          if (other === analysis) continue
          if (other.ecus.some(e => e.topDIDs.some(d => d.did === did))) {
            isUnique = false
            break
          }
        }
        if (isUnique) {
          uniqueDIDs.push({
            did,
            name: this.STANDARD_DIDS.get(did) || `DID_${did}`
          })
        }
      }

      if (uniqueDIDs.length > 0) {
        uniqueDIDsByVehicle.set(vehicleId, uniqueDIDs)
      }

      // Track protocol variations
      protocolVariations.push({
        vehicle: vehicleId,
        protocol: analysis.statistics.protocolUsed
      })
    }

    // Calculate ECU count variation
    const ecuCounts = analyses.map(a => a.statistics.uniqueECUs)
    const ecuCountVariation = {
      min: Math.min(...ecuCounts),
      max: Math.max(...ecuCounts),
      average: ecuCounts.reduce((a, b) => a + b, 0) / ecuCounts.length,
      stdDev: this.calculateStdDev(ecuCounts)
    }

    return {
      uniqueDIDsByVehicle,
      uniqueServicesByVehicle,
      protocolVariations,
      ecuCountVariation
    }
  }

  /**
   * Identify manufacturer-specific patterns
   */
  private identifyManufacturerPatterns(analyses: TraceAnalysisResult[]): ManufacturerPattern[] {
    const manufacturerData = new Map<string, TraceAnalysisResult[]>()

    // Group by manufacturer
    for (const analysis of analyses) {
      if (!manufacturerData.has(analysis.oem)) {
        manufacturerData.set(analysis.oem, [])
      }
      manufacturerData.get(analysis.oem)!.push(analysis)
    }

    const patterns: ManufacturerPattern[] = []

    for (const [manufacturer, mfgAnalyses] of manufacturerData) {
      // Find preferred protocol
      const protocols = mfgAnalyses.map(a => a.statistics.protocolUsed)
      const preferredProtocol = this.mostCommon(protocols)

      // Calculate average ECU count
      const ecuCounts = mfgAnalyses.map(a => a.statistics.uniqueECUs)
      const averageECUCount = ecuCounts.reduce((a, b) => a + b, 0) / ecuCounts.length

      // Find common DIDs
      const didFrequency = new Map<string, number>()
      for (const analysis of mfgAnalyses) {
        for (const ecu of analysis.ecus) {
          for (const did of ecu.topDIDs) {
            didFrequency.set(did.did, (didFrequency.get(did.did) || 0) + 1)
          }
        }
      }
      const commonDIDs = Array.from(didFrequency.entries())
        .filter(([_, count]) => count >= mfgAnalyses.length / 2)
        .map(([did]) => did)

      // Find common services
      const serviceFrequency = new Map<string, number>()
      for (const analysis of mfgAnalyses) {
        for (const service of analysis.statistics.totalServices) {
          serviceFrequency.set(service, (serviceFrequency.get(service) || 0) + 1)
        }
      }
      const commonServices = Array.from(serviceFrequency.entries())
        .filter(([_, count]) => count >= mfgAnalyses.length / 2)
        .map(([service]) => service)

      // Determine addressing scheme
      let addressingScheme = 'Standard'
      if (mfgAnalyses.some(a => a.ecus.some(e => e.address.length > 2))) {
        addressingScheme = 'Extended'
      }

      // Determine security approach
      let securityApproach = 'Basic'
      if (mfgAnalyses.some(a => a.statistics.securityLevels.size > 1)) {
        securityApproach = 'Multi-level'
      }

      patterns.push({
        manufacturer,
        characteristics: {
          preferredProtocol,
          averageECUCount,
          commonDIDs,
          commonServices,
          addressingScheme,
          securityApproach
        }
      })
    }

    return patterns
  }

  /**
   * Helper: Extract ECU type from name
   */
  private extractECUType(name: string): string | null {
    for (const type of this.EXPECTED_ECU_TYPES) {
      if (name.toLowerCase().includes(type.toLowerCase())) {
        return type
      }
    }
    return null
  }

  /**
   * Helper: Calculate duration between timestamps
   */
  private calculateDuration(start: string, end: string): string {
    const parseTime = (time: string) => {
      const [h, m, s] = time.split(':')
      const [sec, ms] = s.split('.')
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms) / 1000
    }

    const startSeconds = parseTime(start)
    const endSeconds = parseTime(end)
    const duration = endSeconds - startSeconds

    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`
  }

  /**
   * Helper: Parse duration to seconds
   */
  private parseDurationToSeconds(duration: string): number {
    const [h, m, s] = duration.split(':')
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)
  }

  /**
   * Helper: Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(variance)
  }

  /**
   * Helper: Find most common element
   */
  private mostCommon<T>(arr: T[]): T {
    const frequency = new Map<T, number>()
    for (const item of arr) {
      frequency.set(item, (frequency.get(item) || 0) + 1)
    }
    let maxCount = 0
    let mostCommon = arr[0]
    for (const [item, count] of frequency) {
      if (count > maxCount) {
        maxCount = count
        mostCommon = item
      }
    }
    return mostCommon
  }

  /**
   * Generate detailed analysis report
   */
  async generateReport(analysis: TraceAnalysisResult, outputPath: string): Promise<void> {
    const report = `
# Trace Analysis Report
## ${analysis.oem} ${analysis.model} (${analysis.year})

### File Information
- **File**: ${analysis.file}
- **Size**: ${(analysis.statistics.fileSize / 1024).toFixed(2)} KB
- **Duration**: ${analysis.statistics.duration}
- **Total Messages**: ${analysis.statistics.totalMessages}
- **Messages/Second**: ${analysis.statistics.messagesPerSecond}
- **Protocol**: ${analysis.statistics.protocolUsed}

### ECU Summary
- **Total ECUs**: ${analysis.statistics.uniqueECUs}
- **Total DIDs**: ${analysis.statistics.totalDIDs}
- **Total DTCs**: ${analysis.statistics.totalDTCs}
- **Total Routines**: ${analysis.statistics.totalRoutines}

### ECU Details

${analysis.ecus.map(ecu => `
#### ${ecu.name} (${ecu.address})
- **Protocol**: ${ecu.protocol}
- **Messages**: ${ecu.messageCount} (${ecu.messagePercentage.toFixed(1)}%)
- **Services**: ${ecu.services.join(', ')}
- **DIDs**: ${ecu.didCount}
- **DTCs**: ${ecu.dtcCount}
- **Routines**: ${ecu.routineCount}
- **Session Types**: ${ecu.sessionTypes.join(', ')}
- **Security Levels**: ${ecu.securityLevels.join(', ')}
- **Completeness**: ${ecu.dataCompleteness}%

**Top DIDs:**
${ecu.topDIDs.map(d => `- ${d.did}: ${d.name}`).join('\n')}
`).join('\n')}

### Common Patterns

#### Most Common Services
${analysis.commonPatterns.mostCommonServices.map(s =>
  `- **${s.service}** (${s.name}): ${s.count} ECUs`
).join('\n')}

#### Most Common DIDs
${analysis.commonPatterns.mostCommonDIDs.map(d =>
  `- **${d.did}** (${d.name}): ${d.count} ECUs`
).join('\n')}

#### Communication Patterns
${analysis.commonPatterns.communicationPatterns.map(p =>
  `- **${p.pattern}**: ${p.description} (${p.count} ECUs)`
).join('\n')}

### Data Quality Assessment
- **Overall Score**: ${analysis.dataQuality.overallScore}/100
- **Completeness**: ${analysis.dataQuality.completeness}%
- **Consistency**: ${analysis.dataQuality.consistency}%

#### Coverage
- **Services**: ${analysis.dataQuality.coverage.services}%
- **Standard DIDs**: ${analysis.dataQuality.coverage.standardDIDs}%
- **ECU Types**: ${analysis.dataQuality.coverage.ecuTypes}%

#### Issues
${analysis.dataQuality.issues.map(i =>
  `- **[${i.severity.toUpperCase()}]** ${i.description}`
).join('\n')}

#### Recommendations
${analysis.dataQuality.recommendations.map(r => `- ${r}`).join('\n')}
    `

    await fs.writeFile(outputPath, report)
  }

  /**
   * Generate comparison report as markdown
   */
  async generateComparisonReport(comparison: ComparisonReport, outputPath: string): Promise<void> {
    const report = `
# Vehicle Comparison Report

## Vehicle Summary

| OEM | Model | Year | ECUs | DIDs | DTCs | Protocol |
|-----|-------|------|------|------|------|----------|
${comparison.vehicles.map(v =>
  `| ${v.oem} | ${v.model} | ${v.year} | ${v.ecuCount} | ${v.didCount} | ${v.dtcCount} | ${v.protocol} |`
).join('\n')}

## Commonalities Across Vehicles

### Common DIDs (Found in Multiple Vehicles)
${comparison.commonalities.commonDIDs.slice(0, 10).map(d =>
  `- **${d.did}** (${d.name}): ${d.vehicles} vehicles (${d.percentage.toFixed(1)}%)`
).join('\n')}

### Common Services
${comparison.commonalities.commonServices.slice(0, 10).map(s =>
  `- **${s.service}** (${s.name}): ${s.vehicles} vehicles (${s.percentage.toFixed(1)}%)`
).join('\n')}

### ECU Type Distribution
${comparison.commonalities.commonECUTypes.map(e =>
  `- **${e.type}**: ${e.vehicles} vehicles (${e.percentage.toFixed(1)}%)`
).join('\n')}

### Protocol Distribution
${comparison.commonalities.protocolDistribution.map(p =>
  `- **${p.protocol}**: ${p.count} vehicles (${p.percentage.toFixed(1)}%)`
).join('\n')}

## Differences

### ECU Count Variation
- **Minimum**: ${comparison.differences.ecuCountVariation.min}
- **Maximum**: ${comparison.differences.ecuCountVariation.max}
- **Average**: ${comparison.differences.ecuCountVariation.average.toFixed(1)}
- **Std Dev**: ${comparison.differences.ecuCountVariation.stdDev.toFixed(2)}

### Protocol Variations
${comparison.differences.protocolVariations.map(p =>
  `- ${p.vehicle}: ${p.protocol}`
).join('\n')}

## Manufacturer Patterns

${comparison.manufacturerPatterns.map(m => `
### ${m.manufacturer}
- **Preferred Protocol**: ${m.characteristics.preferredProtocol}
- **Average ECU Count**: ${m.characteristics.averageECUCount.toFixed(1)}
- **Addressing Scheme**: ${m.characteristics.addressingScheme}
- **Security Approach**: ${m.characteristics.securityApproach}
- **Common Services**: ${m.characteristics.commonServices.join(', ')}
- **Common DIDs**: ${m.characteristics.commonDIDs.join(', ')}
`).join('\n')}
    `

    await fs.writeFile(outputPath, report)
  }
}