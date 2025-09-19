import * as fs from 'fs-extra'
import * as path from 'path'
import { parseStringPromise } from 'xml2js'
import { XMLValidator } from 'fast-xml-parser'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  compliance: ComplianceReport
  statistics: ODXStatistics
}

export interface ValidationError {
  severity: 'error' | 'critical'
  location: string
  message: string
  rule: string
}

export interface ValidationWarning {
  severity: 'warning' | 'info'
  location: string
  message: string
  suggestion?: string
}

export interface ComplianceReport {
  version: string
  standard: 'ASAM MCD-2D'
  level: 'Basic' | 'Extended' | 'Full'
  requiredElements: ComplianceCheck[]
  optionalElements: ComplianceCheck[]
  score: number // 0-100
}

export interface ComplianceCheck {
  element: string
  required: boolean
  present: boolean
  valid: boolean
  notes?: string
}

export interface ODXStatistics {
  fileSize: number
  elements: number
  services: number
  dids: number
  dtcs: number
  routines: number
  layers: number
  protocols: number
}

/**
 * ODX Validator based on ASAM MCD-2D Specification
 * Validates generated ODX files against ODX 2.2.0 schema and specification requirements
 */
export class ODXValidator {
  private readonly ODX_VERSION = '2.2.0'
  private readonly NAMESPACE = 'http://www.asam.net/xml/ODX'

  // Required elements per ASAM MCD-2D spec
  private readonly REQUIRED_ELEMENTS = {
    'ODX': {
      attributes: ['xmlns:xsi', 'xsi:schemaLocation'],
      children: []
    },
    'DIAG-LAYER': {
      attributes: ['ID', 'xsi:type'],
      children: ['SHORT-NAME', 'LONG-NAME']
    },
    'DIAG-SERVICE': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'REQUEST', 'POS-RESPONSE']
    },
    'DATA-OBJECT-PROP': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'COMPU-METHOD', 'DIAG-CODED-TYPE']
    },
    'DTC': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'TROUBLE-CODE', 'DISPLAY-TROUBLE-CODE']
    },
    'ROUTINE': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'INPUT-PARAMS', 'OUTPUT-PARAMS']
    },
    'PROTOCOL': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'PROTOCOL-TYPE']
    },
    'VEHICLE-INFO-SPEC': {
      attributes: [],
      children: ['VEHICLE-INFOS']
    },
    'ECU-VARIANT': {
      attributes: ['ID'],
      children: ['SHORT-NAME', 'ECU-MEM', 'DIAG-LAYER-REF']
    }
  }

  // UDS service IDs as per ISO 14229
  private readonly UDS_SERVICES = {
    '10': 'DiagnosticSessionControl',
    '11': 'ECUReset',
    '14': 'ClearDiagnosticInformation',
    '19': 'ReadDTCInformation',
    '22': 'ReadDataByIdentifier',
    '23': 'ReadMemoryByAddress',
    '24': 'ReadScalingDataByIdentifier',
    '27': 'SecurityAccess',
    '28': 'CommunicationControl',
    '2A': 'ReadDataByPeriodicIdentifier',
    '2C': 'DynamicallyDefineDataIdentifier',
    '2E': 'WriteDataByIdentifier',
    '2F': 'InputOutputControlByIdentifier',
    '31': 'RoutineControl',
    '34': 'RequestDownload',
    '35': 'RequestUpload',
    '36': 'TransferData',
    '37': 'RequestTransferExit',
    '38': 'RequestFileTransfer',
    '3D': 'WriteMemoryByAddress',
    '3E': 'TesterPresent',
    '84': 'SecuredDataTransmission',
    '85': 'ControlDTCSetting',
    '86': 'ResponseOnEvent',
    '87': 'LinkControl'
  }

  /**
   * Validate an ODX file against ASAM MCD-2D specification
   */
  async validateFile(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8')
      const fileSize = Buffer.byteLength(content)

      // Basic XML validation
      const xmlValid = XMLValidator.validate(content, {
        allowBooleanAttributes: true,
        ignoreAttributes: false
      })

      if (xmlValid !== true) {
        errors.push({
          severity: 'critical',
          location: filePath,
          message: `Invalid XML: ${xmlValid.err.msg}`,
          rule: 'XML_WELLFORMED'
        })
      }

      // Parse XML for detailed validation
      const parsed = await parseStringPromise(content)

      // Validate ODX structure
      const structureValidation = this.validateStructure(parsed, path.basename(filePath))
      errors.push(...structureValidation.errors)
      warnings.push(...structureValidation.warnings)

      // Validate against ODX schema requirements
      const schemaValidation = this.validateSchema(parsed)
      errors.push(...schemaValidation.errors)
      warnings.push(...schemaValidation.warnings)

      // Validate UDS compliance
      const udsValidation = this.validateUDSCompliance(parsed)
      warnings.push(...udsValidation.warnings)

      // Generate compliance report
      const compliance = this.generateComplianceReport(parsed, errors)

      // Collect statistics
      const statistics = this.collectStatistics(parsed, fileSize)

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        compliance,
        statistics
      }
    } catch (error) {
      errors.push({
        severity: 'critical',
        location: filePath,
        message: `Failed to validate file: ${error.message}`,
        rule: 'FILE_READ_ERROR'
      })

      return {
        valid: false,
        errors,
        warnings,
        compliance: this.getEmptyComplianceReport(),
        statistics: this.getEmptyStatistics()
      }
    }
  }

  /**
   * Validate multiple ODX files as a package
   */
  async validatePackage(directory: string): Promise<ValidationResult> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const allStatistics: ODXStatistics[] = []

    try {
      // Find all ODX files in directory
      const files = await fs.readdir(directory)
      const odxFiles = files.filter(f => f.match(/\.odx(-[vdpc])?$/i))

      if (odxFiles.length === 0) {
        errors.push({
          severity: 'error',
          location: directory,
          message: 'No ODX files found in directory',
          rule: 'PACKAGE_EMPTY'
        })
      }

      // Check for required file types
      const hasVehicleInfo = odxFiles.some(f => f.endsWith('.odx-v'))
      const hasDiagLayer = odxFiles.some(f => f.endsWith('.odx-d'))

      if (!hasVehicleInfo) {
        warnings.push({
          severity: 'warning',
          location: directory,
          message: 'No vehicle information file (.odx-v) found',
          suggestion: 'Add a vehicle information file for complete ODX package'
        })
      }

      if (!hasDiagLayer) {
        errors.push({
          severity: 'error',
          location: directory,
          message: 'No diagnostic layer file (.odx-d) found',
          rule: 'PACKAGE_MISSING_DIAG_LAYER'
        })
      }

      // Validate each file
      for (const file of odxFiles) {
        const filePath = path.join(directory, file)
        const result = await this.validateFile(filePath)
        errors.push(...result.errors)
        warnings.push(...result.warnings)
        allStatistics.push(result.statistics)
      }

      // Check cross-file references
      const refValidation = await this.validateCrossReferences(directory, odxFiles)
      errors.push(...refValidation.errors)
      warnings.push(...refValidation.warnings)

      // Aggregate statistics
      const totalStatistics = this.aggregateStatistics(allStatistics)

      // Generate overall compliance
      const compliance = this.calculatePackageCompliance(errors, warnings, odxFiles.length)

      return {
        valid: errors.filter(e => e.severity === 'critical').length === 0,
        errors,
        warnings,
        compliance,
        statistics: totalStatistics
      }
    } catch (error) {
      errors.push({
        severity: 'critical',
        location: directory,
        message: `Failed to validate package: ${error.message}`,
        rule: 'PACKAGE_VALIDATION_ERROR'
      })

      return {
        valid: false,
        errors,
        warnings,
        compliance: this.getEmptyComplianceReport(),
        statistics: this.getEmptyStatistics()
      }
    }
  }

  /**
   * Validate ODX structure according to specification
   */
  private validateStructure(parsed: any, fileName: string): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Check root element
    if (!parsed['ODX']) {
      errors.push({
        severity: 'critical',
        location: fileName,
        message: 'Missing root ODX element',
        rule: 'STRUCTURE_MISSING_ROOT'
      })
      return { errors, warnings }
    }

    const odx = parsed['ODX']

    // Check ODX version
    if (odx['$'] && odx['$']['ODX-VERSION'] !== this.ODX_VERSION) {
      warnings.push({
        severity: 'warning',
        location: fileName,
        message: `ODX version is ${odx['$']['ODX-VERSION']}, expected ${this.ODX_VERSION}`,
        suggestion: `Update to ODX version ${this.ODX_VERSION} for full compliance`
      })
    }

    // Check namespace
    if (odx['$'] && !odx['$']['xmlns:xsi']) {
      errors.push({
        severity: 'error',
        location: fileName,
        message: 'Missing XML Schema instance namespace',
        rule: 'STRUCTURE_MISSING_NAMESPACE'
      })
    }

    // Validate based on file type
    if (fileName.endsWith('.odx-v')) {
      this.validateVehicleInfo(odx, errors, warnings)
    } else if (fileName.endsWith('.odx-d')) {
      this.validateDiagLayer(odx, errors, warnings)
    } else if (fileName.endsWith('.odx-p')) {
      this.validateProtocol(odx, errors, warnings)
    } else if (fileName.endsWith('.odx-c')) {
      this.validateComparam(odx, errors, warnings)
    }

    return { errors, warnings }
  }

  /**
   * Validate vehicle information structure
   */
  private validateVehicleInfo(odx: any, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!odx['VEHICLE-INFO-SPEC']) {
      errors.push({
        severity: 'error',
        location: 'VEHICLE-INFO',
        message: 'Missing VEHICLE-INFO-SPEC element',
        rule: 'VEHICLE_MISSING_SPEC'
      })
      return
    }

    const spec = odx['VEHICLE-INFO-SPEC'][0]

    if (!spec['VEHICLE-INFOS']) {
      errors.push({
        severity: 'error',
        location: 'VEHICLE-INFO-SPEC',
        message: 'Missing VEHICLE-INFOS element',
        rule: 'VEHICLE_MISSING_INFOS'
      })
    } else {
      const infos = spec['VEHICLE-INFOS'][0]
      if (!infos['VEHICLE-INFO']) {
        warnings.push({
          severity: 'warning',
          location: 'VEHICLE-INFOS',
          message: 'No VEHICLE-INFO elements found',
          suggestion: 'Add vehicle information for complete documentation'
        })
      }
    }
  }

  /**
   * Validate diagnostic layer structure
   */
  private validateDiagLayer(odx: any, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!odx['DIAG-LAYER-CONTAINER']) {
      errors.push({
        severity: 'error',
        location: 'DIAG-LAYER',
        message: 'Missing DIAG-LAYER-CONTAINER element',
        rule: 'DIAG_MISSING_CONTAINER'
      })
      return
    }

    const container = odx['DIAG-LAYER-CONTAINER'][0]

    // Check for required elements
    if (!container['DIAG-LAYERS']) {
      errors.push({
        severity: 'error',
        location: 'DIAG-LAYER-CONTAINER',
        message: 'Missing DIAG-LAYERS element',
        rule: 'DIAG_MISSING_LAYERS'
      })
    } else {
      const layers = container['DIAG-LAYERS'][0]
      if (!layers['DIAG-LAYER']) {
        errors.push({
          severity: 'error',
          location: 'DIAG-LAYERS',
          message: 'No DIAG-LAYER elements found',
          rule: 'DIAG_EMPTY_LAYERS'
        })
      } else {
        // Validate each layer
        for (const layer of layers['DIAG-LAYER']) {
          this.validateDiagLayerElement(layer, errors, warnings)
        }
      }
    }
  }

  /**
   * Validate individual diagnostic layer element
   */
  private validateDiagLayerElement(layer: any, errors: ValidationError[], warnings: ValidationWarning[]) {
    // Check required attributes
    if (!layer['$'] || !layer['$']['ID']) {
      errors.push({
        severity: 'error',
        location: 'DIAG-LAYER',
        message: 'Missing required ID attribute',
        rule: 'ELEMENT_MISSING_ID'
      })
    }

    // Check required children
    if (!layer['SHORT-NAME']) {
      errors.push({
        severity: 'error',
        location: 'DIAG-LAYER',
        message: 'Missing required SHORT-NAME element',
        rule: 'ELEMENT_MISSING_NAME'
      })
    }

    // Check services
    if (layer['DIAG-SERVICES']) {
      const services = layer['DIAG-SERVICES'][0]
      if (services['DIAG-SERVICE']) {
        for (const service of services['DIAG-SERVICE']) {
          this.validateDiagService(service, warnings)
        }
      }
    } else {
      warnings.push({
        severity: 'info',
        location: 'DIAG-LAYER',
        message: 'No diagnostic services defined',
        suggestion: 'Add diagnostic services for functional completeness'
      })
    }

    // Check DTCs
    if (layer['DTC-DOPS'] && layer['DTC-DOPS'][0]['DTC-DOP']) {
      const dtcCount = layer['DTC-DOPS'][0]['DTC-DOP'].length
      if (dtcCount > 1000) {
        warnings.push({
          severity: 'warning',
          location: 'DTC-DOPS',
          message: `Large number of DTCs (${dtcCount}) may impact performance`,
          suggestion: 'Consider splitting DTCs across multiple layers if performance issues occur'
        })
      }
    }
  }

  /**
   * Validate diagnostic service
   */
  private validateDiagService(service: any, warnings: ValidationWarning[]) {
    // Check if service ID matches known UDS services
    if (service['REQUEST'] && service['REQUEST'][0]['ID']) {
      const serviceId = service['REQUEST'][0]['ID']
      const hexId = serviceId.replace('0x', '').toUpperCase()

      if (!this.UDS_SERVICES[hexId] && !serviceId.startsWith('0x2')) {
        warnings.push({
          severity: 'info',
          location: `DIAG-SERVICE[${serviceId}]`,
          message: `Non-standard service ID: ${serviceId}`,
          suggestion: 'Verify this is a manufacturer-specific service'
        })
      }
    }
  }

  /**
   * Validate protocol structure
   */
  private validateProtocol(odx: any, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!odx['PROTOCOL']) {
      errors.push({
        severity: 'error',
        location: 'PROTOCOL',
        message: 'Missing PROTOCOL element',
        rule: 'PROTOCOL_MISSING'
      })
      return
    }

    const protocol = odx['PROTOCOL'][0]

    if (!protocol['PROTOCOL-TYPE']) {
      errors.push({
        severity: 'error',
        location: 'PROTOCOL',
        message: 'Missing PROTOCOL-TYPE element',
        rule: 'PROTOCOL_MISSING_TYPE'
      })
    }

    // Check for known protocol types
    const validProtocols = ['UDS', 'KWP2000', 'ISO-TP', 'DoIP', 'CAN', 'FLEXRAY']
    if (protocol['PROTOCOL-TYPE'] && !validProtocols.includes(protocol['PROTOCOL-TYPE'][0])) {
      warnings.push({
        severity: 'warning',
        location: 'PROTOCOL-TYPE',
        message: `Unknown protocol type: ${protocol['PROTOCOL-TYPE'][0]}`,
        suggestion: 'Use standard protocol types when possible'
      })
    }
  }

  /**
   * Validate communication parameters
   */
  private validateComparam(odx: any, errors: ValidationError[], warnings: ValidationWarning[]) {
    if (!odx['COMPARAM-SPEC']) {
      errors.push({
        severity: 'error',
        location: 'COMPARAM',
        message: 'Missing COMPARAM-SPEC element',
        rule: 'COMPARAM_MISSING_SPEC'
      })
      return
    }

    const spec = odx['COMPARAM-SPEC'][0]

    if (!spec['PROT-STACKS']) {
      warnings.push({
        severity: 'warning',
        location: 'COMPARAM-SPEC',
        message: 'Missing PROT-STACKS element',
        suggestion: 'Define protocol stacks for complete communication specification'
      })
    }
  }

  /**
   * Validate against ODX schema requirements
   */
  private validateSchema(parsed: any): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // This would ideally validate against the actual XSD schema
    // For now, we check structural requirements

    const checkElement = (element: any, path: string, requirements: any) => {
      // Check required attributes
      if (requirements.attributes && element['$']) {
        for (const attr of requirements.attributes) {
          if (!element['$'][attr]) {
            errors.push({
              severity: 'error',
              location: path,
              message: `Missing required attribute: ${attr}`,
              rule: 'SCHEMA_MISSING_ATTRIBUTE'
            })
          }
        }
      }

      // Check required children
      if (requirements.children) {
        for (const child of requirements.children) {
          if (!element[child]) {
            errors.push({
              severity: 'error',
              location: path,
              message: `Missing required child element: ${child}`,
              rule: 'SCHEMA_MISSING_CHILD'
            })
          }
        }
      }
    }

    // Recursively validate elements
    const validateElement = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return

      for (const key in obj) {
        if (key === '$') continue // Skip attributes

        const newPath = path ? `${path}/${key}` : key

        if (this.REQUIRED_ELEMENTS[key]) {
          if (Array.isArray(obj[key])) {
            for (let i = 0; i < obj[key].length; i++) {
              checkElement(obj[key][i], `${newPath}[${i}]`, this.REQUIRED_ELEMENTS[key])
              validateElement(obj[key][i], `${newPath}[${i}]`)
            }
          } else {
            checkElement(obj[key], newPath, this.REQUIRED_ELEMENTS[key])
            validateElement(obj[key], newPath)
          }
        } else if (typeof obj[key] === 'object') {
          validateElement(obj[key], newPath)
        }
      }
    }

    validateElement(parsed)

    return { errors, warnings }
  }

  /**
   * Validate UDS compliance
   */
  private validateUDSCompliance(parsed: any): { warnings: ValidationWarning[] } {
    const warnings: ValidationWarning[] = []

    // Find all diagnostic services
    const findServices = (obj: any): string[] => {
      const services: string[] = []

      if (obj['DIAG-SERVICES'] && obj['DIAG-SERVICES'][0]['DIAG-SERVICE']) {
        for (const service of obj['DIAG-SERVICES'][0]['DIAG-SERVICE']) {
          if (service['REQUEST'] && service['REQUEST'][0]['ID']) {
            services.push(service['REQUEST'][0]['ID'])
          }
        }
      }

      // Recursively search
      for (const key in obj) {
        if (typeof obj[key] === 'object' && key !== 'DIAG-SERVICES') {
          services.push(...findServices(obj[key]))
        }
      }

      return services
    }

    const services = findServices(parsed)

    // Check for mandatory UDS services
    const mandatoryServices = ['10', '3E'] // Session Control and Tester Present
    for (const mandatory of mandatoryServices) {
      if (!services.some(s => s.includes(mandatory))) {
        warnings.push({
          severity: 'warning',
          location: 'DIAG-SERVICES',
          message: `Missing mandatory UDS service: 0x${mandatory} (${this.UDS_SERVICES[mandatory]})`,
          suggestion: 'Add mandatory UDS services for standard compliance'
        })
      }
    }

    return { warnings }
  }

  /**
   * Validate cross-references between files
   */
  private async validateCrossReferences(directory: string, files: string[]): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const references = new Map<string, string[]>()
    const definitions = new Set<string>()

    // Collect all IDs and references
    for (const file of files) {
      const filePath = path.join(directory, file)
      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = await parseStringPromise(content)

      // Collect defined IDs
      this.collectIds(parsed, definitions)

      // Collect references
      const fileRefs = this.collectReferences(parsed)
      references.set(file, fileRefs)
    }

    // Check if all references resolve
    for (const [file, refs] of references) {
      for (const ref of refs) {
        if (!definitions.has(ref)) {
          warnings.push({
            severity: 'warning',
            location: file,
            message: `Unresolved reference: ${ref}`,
            suggestion: 'Check if referenced element exists in package'
          })
        }
      }
    }

    return { errors, warnings }
  }

  /**
   * Collect all IDs defined in the document
   */
  private collectIds(obj: any, ids: Set<string>) {
    if (!obj || typeof obj !== 'object') return

    // Check for ID attribute
    if (obj['$'] && obj['$']['ID']) {
      ids.add(obj['$']['ID'])
    }

    // Recursively collect
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        for (const item of obj[key]) {
          this.collectIds(item, ids)
        }
      } else if (typeof obj[key] === 'object') {
        this.collectIds(obj[key], ids)
      }
    }
  }

  /**
   * Collect all references in the document
   */
  private collectReferences(obj: any): string[] {
    const refs: string[] = []

    const collect = (o: any) => {
      if (!o || typeof o !== 'object') return

      // Check for reference attributes
      const refAttrs = ['ID-REF', 'DIAG-LAYER-REF', 'PROTOCOL-REF', 'COMPARAM-REF']
      if (o['$']) {
        for (const attr of refAttrs) {
          if (o['$'][attr]) {
            refs.push(o['$'][attr])
          }
        }
      }

      // Check for reference elements
      const refElements = ['ID-REF', 'REF']
      for (const elem of refElements) {
        if (o[elem]) {
          if (Array.isArray(o[elem])) {
            refs.push(...o[elem])
          } else {
            refs.push(o[elem])
          }
        }
      }

      // Recursively collect
      for (const key in o) {
        if (Array.isArray(o[key])) {
          for (const item of o[key]) {
            collect(item)
          }
        } else if (typeof o[key] === 'object') {
          collect(o[key])
        }
      }
    }

    collect(obj)
    return refs
  }

  /**
   * Generate compliance report
   */
  private generateComplianceReport(parsed: any, errors: ValidationError[]): ComplianceReport {
    const requiredElements: ComplianceCheck[] = []
    const optionalElements: ComplianceCheck[] = []

    // Check required elements
    const checkRequired = (name: string, path: string) => {
      const element = this.getElement(parsed, path)
      requiredElements.push({
        element: name,
        required: true,
        present: !!element,
        valid: !!element && !errors.some(e => e.location.includes(name))
      })
    }

    // Check ODX structure elements
    checkRequired('ODX Root', 'ODX')
    checkRequired('Schema Declaration', 'ODX.$')

    // Check based on content type
    if (parsed['ODX']) {
      if (parsed['ODX']['DIAG-LAYER-CONTAINER']) {
        checkRequired('Diagnostic Layer Container', 'ODX.DIAG-LAYER-CONTAINER')
        checkRequired('Diagnostic Layers', 'ODX.DIAG-LAYER-CONTAINER[0].DIAG-LAYERS')
      } else if (parsed['ODX']['VEHICLE-INFO-SPEC']) {
        checkRequired('Vehicle Info Specification', 'ODX.VEHICLE-INFO-SPEC')
      } else if (parsed['ODX']['PROTOCOL']) {
        checkRequired('Protocol Definition', 'ODX.PROTOCOL')
      } else if (parsed['ODX']['COMPARAM-SPEC']) {
        checkRequired('Communication Parameters', 'ODX.COMPARAM-SPEC')
      }
    }

    // Check optional elements
    const checkOptional = (name: string, path: string) => {
      const element = this.getElement(parsed, path)
      optionalElements.push({
        element: name,
        required: false,
        present: !!element,
        valid: !!element && !errors.some(e => e.location.includes(name))
      })
    }

    // Optional elements
    checkOptional('Admin Data', 'ODX.ADMIN-DATA')
    checkOptional('Company Data', 'ODX.COMPANY-DATAS')
    checkOptional('Documentation', 'ODX.DOC-REVISIONS')

    // Calculate compliance score
    const requiredScore = requiredElements.filter(e => e.valid).length / requiredElements.length * 70
    const optionalScore = optionalElements.filter(e => e.present && e.valid).length / optionalElements.length * 30
    const score = Math.round(requiredScore + optionalScore)

    // Determine compliance level
    let level: 'Basic' | 'Extended' | 'Full' = 'Basic'
    if (score >= 90) level = 'Full'
    else if (score >= 70) level = 'Extended'

    return {
      version: this.ODX_VERSION,
      standard: 'ASAM MCD-2D',
      level,
      requiredElements,
      optionalElements,
      score
    }
  }

  /**
   * Get element from parsed object using path
   */
  private getElement(obj: any, path: string): any {
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (part.includes('[')) {
        const [name, indexStr] = part.split('[')
        const index = parseInt(indexStr.replace(']', ''))
        current = current?.[name]?.[index]
      } else {
        current = current?.[part]
      }

      if (!current) return null
    }

    return current
  }

  /**
   * Collect statistics from parsed ODX
   */
  private collectStatistics(parsed: any, fileSize: number): ODXStatistics {
    let elements = 0
    let services = 0
    let dids = 0
    let dtcs = 0
    let routines = 0
    let layers = 0
    let protocols = 0

    // Count elements recursively
    const count = (obj: any) => {
      if (!obj || typeof obj !== 'object') return

      elements++

      // Count specific element types
      if (obj['DIAG-SERVICE']) {
        services += Array.isArray(obj['DIAG-SERVICE']) ? obj['DIAG-SERVICE'].length : 1
      }
      if (obj['DATA-OBJECT-PROP']) {
        dids += Array.isArray(obj['DATA-OBJECT-PROP']) ? obj['DATA-OBJECT-PROP'].length : 1
      }
      if (obj['DTC-DOP']) {
        dtcs += Array.isArray(obj['DTC-DOP']) ? obj['DTC-DOP'].length : 1
      }
      if (obj['ROUTINE']) {
        routines += Array.isArray(obj['ROUTINE']) ? obj['ROUTINE'].length : 1
      }
      if (obj['DIAG-LAYER']) {
        layers += Array.isArray(obj['DIAG-LAYER']) ? obj['DIAG-LAYER'].length : 1
      }
      if (obj['PROTOCOL']) {
        protocols += Array.isArray(obj['PROTOCOL']) ? obj['PROTOCOL'].length : 1
      }

      // Recursively count
      for (const key in obj) {
        if (key === '$') continue
        if (Array.isArray(obj[key])) {
          for (const item of obj[key]) {
            count(item)
          }
        } else if (typeof obj[key] === 'object') {
          count(obj[key])
        }
      }
    }

    count(parsed)

    return {
      fileSize,
      elements,
      services,
      dids,
      dtcs,
      routines,
      layers,
      protocols
    }
  }

  /**
   * Aggregate statistics from multiple files
   */
  private aggregateStatistics(statistics: ODXStatistics[]): ODXStatistics {
    return statistics.reduce((acc, stat) => ({
      fileSize: acc.fileSize + stat.fileSize,
      elements: acc.elements + stat.elements,
      services: acc.services + stat.services,
      dids: acc.dids + stat.dids,
      dtcs: acc.dtcs + stat.dtcs,
      routines: acc.routines + stat.routines,
      layers: acc.layers + stat.layers,
      protocols: acc.protocols + stat.protocols
    }), this.getEmptyStatistics())
  }

  /**
   * Calculate package-level compliance
   */
  private calculatePackageCompliance(errors: ValidationError[], warnings: ValidationWarning[], fileCount: number): ComplianceReport {
    const criticalErrors = errors.filter(e => e.severity === 'critical').length
    const normalErrors = errors.filter(e => e.severity === 'error').length

    // Calculate score based on error severity
    let score = 100
    score -= criticalErrors * 20
    score -= normalErrors * 10
    score -= warnings.length * 2
    score = Math.max(0, Math.min(100, score))

    // Determine level
    let level: 'Basic' | 'Extended' | 'Full' = 'Basic'
    if (score >= 90 && criticalErrors === 0) level = 'Full'
    else if (score >= 70 && criticalErrors === 0) level = 'Extended'

    return {
      version: this.ODX_VERSION,
      standard: 'ASAM MCD-2D',
      level,
      requiredElements: [],
      optionalElements: [],
      score
    }
  }

  /**
   * Get empty compliance report
   */
  private getEmptyComplianceReport(): ComplianceReport {
    return {
      version: this.ODX_VERSION,
      standard: 'ASAM MCD-2D',
      level: 'Basic',
      requiredElements: [],
      optionalElements: [],
      score: 0
    }
  }

  /**
   * Get empty statistics
   */
  private getEmptyStatistics(): ODXStatistics {
    return {
      fileSize: 0,
      elements: 0,
      services: 0,
      dids: 0,
      dtcs: 0,
      routines: 0,
      layers: 0,
      protocols: 0
    }
  }

  /**
   * Generate validation report as HTML
   */
  async generateHTMLReport(result: ValidationResult, outputPath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ODX Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    h2 { color: #666; border-bottom: 2px solid #eee; padding-bottom: 5px; }
    .valid { color: green; }
    .invalid { color: red; }
    .warning { color: orange; }
    .error { background: #fee; padding: 10px; margin: 5px 0; border-left: 3px solid red; }
    .warning-box { background: #ffc; padding: 10px; margin: 5px 0; border-left: 3px solid orange; }
    .info { background: #e6f3ff; padding: 10px; margin: 5px 0; border-left: 3px solid #007bff; }
    .statistics { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .compliance { background: #f0f8ff; padding: 15px; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .score { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>ODX Validation Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <h2>Overall Status</h2>
  <p class="${result.valid ? 'valid' : 'invalid'}">
    <strong>${result.valid ? '✓ VALID' : '✗ INVALID'}</strong>
  </p>

  <h2>Compliance</h2>
  <div class="compliance">
    <p>Standard: ${result.compliance.standard} v${result.compliance.version}</p>
    <p>Compliance Level: <strong>${result.compliance.level}</strong></p>
    <p class="score">Score: ${result.compliance.score}/100</p>
  </div>

  <h2>Statistics</h2>
  <div class="statistics">
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>File Size</td><td>${(result.statistics.fileSize / 1024).toFixed(2)} KB</td></tr>
      <tr><td>Total Elements</td><td>${result.statistics.elements}</td></tr>
      <tr><td>Services</td><td>${result.statistics.services}</td></tr>
      <tr><td>DIDs</td><td>${result.statistics.dids}</td></tr>
      <tr><td>DTCs</td><td>${result.statistics.dtcs}</td></tr>
      <tr><td>Routines</td><td>${result.statistics.routines}</td></tr>
      <tr><td>Layers</td><td>${result.statistics.layers}</td></tr>
      <tr><td>Protocols</td><td>${result.statistics.protocols}</td></tr>
    </table>
  </div>

  <h2>Errors (${result.errors.length})</h2>
  ${result.errors.length === 0 ? '<p class="valid">No errors found</p>' : ''}
  ${result.errors.map(e => `
    <div class="error">
      <strong>[${e.severity.toUpperCase()}]</strong> ${e.location}<br>
      ${e.message}<br>
      <small>Rule: ${e.rule}</small>
    </div>
  `).join('')}

  <h2>Warnings (${result.warnings.length})</h2>
  ${result.warnings.length === 0 ? '<p class="valid">No warnings found</p>' : ''}
  ${result.warnings.map(w => `
    <div class="warning-box">
      <strong>[${w.severity.toUpperCase()}]</strong> ${w.location}<br>
      ${w.message}<br>
      ${w.suggestion ? `<em>Suggestion: ${w.suggestion}</em>` : ''}
    </div>
  `).join('')}

  <h2>Required Elements</h2>
  <table>
    <tr><th>Element</th><th>Present</th><th>Valid</th></tr>
    ${result.compliance.requiredElements.map(e => `
      <tr>
        <td>${e.element}</td>
        <td class="${e.present ? 'valid' : 'invalid'}">${e.present ? '✓' : '✗'}</td>
        <td class="${e.valid ? 'valid' : 'invalid'}">${e.valid ? '✓' : '✗'}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Optional Elements</h2>
  <table>
    <tr><th>Element</th><th>Present</th><th>Valid</th></tr>
    ${result.compliance.optionalElements.map(e => `
      <tr>
        <td>${e.element}</td>
        <td>${e.present ? '✓' : '-'}</td>
        <td>${e.valid ? '✓' : (e.present ? '✗' : '-')}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
    `

    await fs.writeFile(outputPath, html)
  }
}