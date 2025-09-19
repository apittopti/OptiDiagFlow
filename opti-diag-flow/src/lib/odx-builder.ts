/**
 * ODX Builder Service
 * Progressively builds ODX-compliant structures from discovered UDS data
 * Implements ISO 22901 (ODX) standard
 */

import { ECUInfo, UDSMessage } from './uds-decoder'

export interface ODXLayer {
  id: string
  shortName: string
  longName?: string
  description?: string
  type: 'PROTOCOL' | 'FUNCTIONAL' | 'BASE-VARIANT' | 'ECU-VARIANT'
}

export interface ODXDiagService {
  id: string
  shortName: string
  longName?: string
  semantic?: string
  requestSID: string
  functionalClassRef?: string
  addressing: 'PHYSICAL' | 'FUNCTIONAL'
  requestParams?: ODXParam[]
  positiveResponseParams?: ODXParam[]
  negativeResponseCodes?: string[]
}

export interface ODXParam {
  id: string
  shortName: string
  longName?: string
  semantic?: 'DATA' | 'ID' | 'SUBFUNCTION' | 'LENGTH'
  bytePosition?: number
  bitPosition?: number
  bitLength?: number
  dataType?: string
  codedValue?: string
  physicalValue?: string
}

export interface ODXDTC {
  id: string
  dtcNumber: string
  shortName?: string
  longName?: string
  displayTroubleCode?: string
  text?: string
  level?: number
  isVisible: boolean
  environmentContexts?: Array<{
    paramName: string
    paramValue: string
    unit?: string
  }>
}

export interface ODXDID {
  id: string
  dataIdentifier: string
  shortName: string
  longName?: string
  dataLength?: number
  dataType?: string
  resolution?: number
  offset?: number
  unit?: string
  accessLevel?: 'READ' | 'WRITE' | 'READ_WRITE'
}

export interface ODXRoutine {
  id: string
  routineIdentifier: string
  shortName: string
  longName?: string
  routineType?: 'START' | 'STOP' | 'REQUEST_RESULTS'
  inputParams?: ODXParam[]
  outputParams?: ODXParam[]
}

export interface ODXECUVariant {
  id: string
  shortName: string
  longName?: string
  ecuAddress: string
  baseVariantRef?: string
  diagServices: ODXDiagService[]
  dtcs: ODXDTC[]
  dids: ODXDID[]
  routines: ODXRoutine[]
}

export interface ODXVehicle {
  id: string
  shortName: string
  longName?: string
  manufacturer?: string
  model?: string
  modelYear?: number
  vin?: string
  logicalLinks: Array<{
    id: string
    shortName: string
    physicalAddress: string
    functionalAddress?: string
    ecuVariantRef: string
  }>
}

export interface ODXProject {
  id: string
  shortName: string
  longName?: string
  version: string
  companyName?: string
  vehicles: ODXVehicle[]
  ecuVariants: ODXECUVariant[]
  layers: ODXLayer[]
  createdAt: Date
  updatedAt: Date
}

export class ODXBuilder {
  private project: ODXProject
  private ecuVariantMap: Map<string, ODXECUVariant> = new Map()

  constructor(projectName: string = 'ODX_Discovery_Project') {
    this.project = {
      id: this.generateId(),
      shortName: projectName,
      version: '1.0.0',
      vehicles: [],
      ecuVariants: [],
      layers: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Add base protocol layer
    this.project.layers.push({
      id: this.generateId(),
      shortName: 'ISO_14229_UDS',
      longName: 'ISO 14229 Unified Diagnostic Services',
      type: 'PROTOCOL'
    })
  }

  /**
   * Build ODX structure from discovered ECUs and messages
   */
  buildFromDiscovery(
    ecus: Map<string, ECUInfo>,
    messages: UDSMessage[],
    vehicleInfo?: { vin?: string; model?: string; year?: number }
  ): ODXProject {
    // Create ECU variants for each discovered ECU
    for (const [address, ecuInfo] of ecus) {
      const ecuVariant = this.createECUVariant(address, ecuInfo, messages)
      this.ecuVariantMap.set(address, ecuVariant)
      this.project.ecuVariants.push(ecuVariant)
    }

    // Create vehicle if info provided
    if (vehicleInfo) {
      const vehicle = this.createVehicle(vehicleInfo, ecus)
      this.project.vehicles.push(vehicle)
    }

    this.project.updatedAt = new Date()
    return this.project
  }

  /**
   * Create ECU variant from discovered data
   */
  private createECUVariant(
    address: string,
    ecuInfo: ECUInfo,
    messages: UDSMessage[]
  ): ODXECUVariant {
    const ecuMessages = messages.filter(
      msg => msg.target === address || msg.source === address
    )

    const ecuVariant: ODXECUVariant = {
      id: this.generateId(),
      shortName: ecuInfo.name || `ECU_${address}`,
      longName: `${ecuInfo.name || 'Unknown ECU'} at ${address}`,
      ecuAddress: address,
      diagServices: this.extractDiagServices(ecuInfo, ecuMessages),
      dtcs: this.extractDTCs(ecuInfo, ecuMessages),
      dids: this.extractDIDs(ecuInfo, ecuMessages),
      routines: this.extractRoutines(ecuInfo, ecuMessages)
    }

    return ecuVariant
  }

  /**
   * Extract diagnostic services from messages
   */
  private extractDiagServices(ecuInfo: ECUInfo, messages: UDSMessage[]): ODXDiagService[] {
    const services: ODXDiagService[] = []
    const serviceMap = new Map<string, ODXDiagService>()

    for (const serviceId of ecuInfo.discoveredServices) {
      const serviceMsgs = messages.filter(
        msg => msg.serviceId === serviceId && msg.direction === 'request'
      )

      if (serviceMsgs.length === 0) continue

      const service: ODXDiagService = {
        id: this.generateId(),
        shortName: `Service_${serviceId}`,
        longName: serviceMsgs[0].serviceName,
        requestSID: serviceId,
        addressing: 'PHYSICAL',
        requestParams: [],
        positiveResponseParams: []
      }

      // Analyze service-specific parameters
      switch (serviceId) {
        case '10': // DiagnosticSessionControl
          service.requestParams = [{
            id: this.generateId(),
            shortName: 'diagnosticSessionType',
            semantic: 'SUBFUNCTION',
            bytePosition: 1,
            bitLength: 8,
            dataType: 'A_UINT32'
          }]
          break

        case '22': // ReadDataByIdentifier
          const discoveredDIDs = new Set<string>()
          serviceMsgs.forEach(msg => {
            if (msg.decodedData?.did) {
              discoveredDIDs.add(msg.decodedData.did)
            }
          })

          service.requestParams = [{
            id: this.generateId(),
            shortName: 'dataIdentifier',
            semantic: 'ID',
            bytePosition: 1,
            bitLength: 16,
            dataType: 'A_UINT32'
          }]
          break

        case '31': // RoutineControl
          service.requestParams = [
            {
              id: this.generateId(),
              shortName: 'routineControlType',
              semantic: 'SUBFUNCTION',
              bytePosition: 1,
              bitLength: 8,
              dataType: 'A_UINT32'
            },
            {
              id: this.generateId(),
              shortName: 'routineIdentifier',
              semantic: 'ID',
              bytePosition: 2,
              bitLength: 16,
              dataType: 'A_UINT32'
            }
          ]
          break

        case '27': // SecurityAccess
          service.requestParams = [{
            id: this.generateId(),
            shortName: 'securityAccessType',
            semantic: 'SUBFUNCTION',
            bytePosition: 1,
            bitLength: 8,
            dataType: 'A_UINT32'
          }]
          break

        case '3E': // TesterPresent
          service.requestParams = [{
            id: this.generateId(),
            shortName: 'suppressPosRspMsgIndicationBit',
            semantic: 'SUBFUNCTION',
            bytePosition: 1,
            bitLength: 8,
            dataType: 'A_UINT32'
          }]
          break
      }

      serviceMap.set(serviceId, service)
    }

    return Array.from(serviceMap.values())
  }

  /**
   * Extract DTCs from messages
   */
  private extractDTCs(ecuInfo: ECUInfo, messages: UDSMessage[]): ODXDTC[] {
    const dtcs: ODXDTC[] = []
    const dtcMap = new Map<string, ODXDTC>()

    for (const dtcCode of ecuInfo.discoveredDTCs) {
      const dtc: ODXDTC = {
        id: this.generateId(),
        dtcNumber: dtcCode,
        shortName: `DTC_${dtcCode}`,
        displayTroubleCode: this.formatDTCCode(dtcCode),
        isVisible: true
      }

      // Try to determine DTC description from common patterns
      dtc.longName = this.inferDTCDescription(dtcCode)

      dtcMap.set(dtcCode, dtc)
    }

    return Array.from(dtcMap.values())
  }

  /**
   * Format DTC code for display
   */
  private formatDTCCode(dtcCode: string): string {
    if (dtcCode.length === 6) {
      // ISO 14229 format: convert to P/C/B/U code
      const firstByte = parseInt(dtcCode.substring(0, 2), 16)
      const prefix = ['P', 'C', 'B', 'U'][(firstByte >> 6) & 0x03]
      const code = ((firstByte & 0x3F) << 8) | parseInt(dtcCode.substring(2, 4), 16)
      const subCode = dtcCode.substring(4, 6)
      return `${prefix}${code.toString(16).toUpperCase().padStart(4, '0')}:${subCode}`
    }
    return dtcCode
  }

  /**
   * Infer DTC description from code patterns
   */
  private inferDTCDescription(dtcCode: string): string {
    const firstByte = dtcCode.substring(0, 2)

    // Common DTC categories
    if (dtcCode.startsWith('01')) return 'Fuel and Air Metering'
    if (dtcCode.startsWith('02')) return 'Fuel and Air Metering (Injector Circuit)'
    if (dtcCode.startsWith('03')) return 'Ignition System or Misfire'
    if (dtcCode.startsWith('04')) return 'Auxiliary Emissions Controls'
    if (dtcCode.startsWith('05')) return 'Vehicle Speed Controls and Idle Control System'
    if (dtcCode.startsWith('06')) return 'Computer Output Circuit'
    if (dtcCode.startsWith('07')) return 'Transmission'
    if (dtcCode.startsWith('08')) return 'Transmission'

    if (dtcCode.startsWith('C0')) return 'Chassis - General'
    if (dtcCode.startsWith('C1')) return 'Chassis - ABS/TCS/ESP'
    if (dtcCode.startsWith('C2')) return 'Chassis - Steering/Suspension'

    if (dtcCode.startsWith('B0')) return 'Body - General'
    if (dtcCode.startsWith('B1')) return 'Body - Airbag/SRS'
    if (dtcCode.startsWith('B2')) return 'Body - Lighting'

    if (dtcCode.startsWith('U0')) return 'Network - CAN Communication'
    if (dtcCode.startsWith('U1')) return 'Network - Manufacturer Specific'
    if (dtcCode.startsWith('U2')) return 'Network - Manufacturer Specific'
    if (dtcCode.startsWith('U3')) return 'Network - Reserved'

    return 'Diagnostic Trouble Code'
  }

  /**
   * Extract DIDs from messages
   */
  private extractDIDs(ecuInfo: ECUInfo, messages: UDSMessage[]): ODXDID[] {
    const dids: ODXDID[] = []
    const didMap = new Map<string, ODXDID>()

    for (const didId of ecuInfo.discoveredDIDs) {
      // Find messages related to this DID
      const didMessages = messages.filter(
        msg =>
          msg.serviceId === '22' &&
          msg.decodedData?.did === didId
      )

      const did: ODXDID = {
        id: this.generateId(),
        dataIdentifier: didId,
        shortName: `DID_${didId}`,
        longName: this.inferDIDDescription(didId, didMessages),
        accessLevel: 'READ'
      }

      // Try to determine data length from responses
      const responseMsg = didMessages.find(msg => msg.isPositiveResponse)
      if (responseMsg?.decodedData?.value) {
        did.dataLength = responseMsg.decodedData.value.length / 2 // Hex to bytes
      }

      didMap.set(didId, did)
    }

    return Array.from(didMap.values())
  }

  /**
   * Infer DID description from ID and messages
   */
  private inferDIDDescription(didId: string, messages: UDSMessage[]): string {
    // Check for standard DIDs first
    const standardDIDs: Record<string, string> = {
      'F186': 'Active Diagnostic Session',
      'F187': 'Vehicle Manufacturer Spare Part Number',
      'F188': 'Vehicle Manufacturer ECU Software Number',
      'F189': 'Vehicle Manufacturer ECU Software Version',
      'F18A': 'System Supplier Identifier',
      'F18C': 'ECU Software Number',
      'F190': 'VIN',
      'F191': 'Vehicle Manufacturer ECU Hardware Number',
      'F194': 'System Supplier ECU Software Version',
      'F19E': 'Software Installation Date',
      'DD00': 'Boot Software Version',
      'DD01': 'Application Software Version',
      'DD02': 'Application Data Version',
      'DD09': 'ECU Status'
    }

    if (standardDIDs[didId.toUpperCase()]) {
      return standardDIDs[didId.toUpperCase()]
    }

    // Check message decoded data
    const msg = messages.find(m => m.decodedData?.description)
    if (msg?.decodedData?.description) {
      return msg.decodedData.description
    }

    return `Data Identifier ${didId}`
  }

  /**
   * Extract routines from messages
   */
  private extractRoutines(ecuInfo: ECUInfo, messages: UDSMessage[]): ODXRoutine[] {
    const routines: ODXRoutine[] = []
    const routineMap = new Map<string, ODXRoutine>()

    for (const routineId of ecuInfo.discoveredRoutines) {
      const routineMessages = messages.filter(
        msg =>
          msg.serviceId === '31' &&
          msg.decodedData?.routineId === routineId
      )

      const routine: ODXRoutine = {
        id: this.generateId(),
        routineIdentifier: routineId,
        shortName: `Routine_${routineId}`,
        longName: this.inferRoutineDescription(routineId, routineMessages)
      }

      // Determine routine type from messages
      const controlTypes = new Set<string>()
      routineMessages.forEach(msg => {
        if (msg.decodedData?.controlType) {
          controlTypes.add(msg.decodedData.controlType)
        }
      })

      if (controlTypes.has('startRoutine')) routine.routineType = 'START'
      else if (controlTypes.has('stopRoutine')) routine.routineType = 'STOP'
      else if (controlTypes.has('requestRoutineResults')) routine.routineType = 'REQUEST_RESULTS'

      routineMap.set(routineId, routine)
    }

    return Array.from(routineMap.values())
  }

  /**
   * Infer routine description from ID
   */
  private inferRoutineDescription(routineId: string): string {
    // Common routine patterns
    if (routineId.startsWith('02')) return 'Self Test Routine'
    if (routineId.startsWith('03')) return 'Calibration Routine'
    if (routineId.startsWith('04')) return 'Clear/Reset Routine'
    if (routineId.startsWith('08')) return 'Camera Calibration Routine'
    if (routineId.startsWith('0B')) return 'Actuator Test Routine'
    if (routineId.startsWith('0F')) return 'Sensor Calibration Routine'

    return `Diagnostic Routine ${routineId}`
  }

  /**
   * Create vehicle structure
   */
  private createVehicle(
    vehicleInfo: { vin?: string; model?: string; year?: number },
    ecus: Map<string, ECUInfo>
  ): ODXVehicle {
    const vehicle: ODXVehicle = {
      id: this.generateId(),
      shortName: vehicleInfo.model || 'Vehicle',
      longName: `${vehicleInfo.model || 'Vehicle'} ${vehicleInfo.year || ''}`.trim(),
      vin: vehicleInfo.vin,
      model: vehicleInfo.model,
      modelYear: vehicleInfo.year,
      logicalLinks: []
    }

    // Create logical links for each ECU
    for (const [address, ecuInfo] of ecus) {
      const ecuVariant = this.ecuVariantMap.get(address)
      if (ecuVariant) {
        vehicle.logicalLinks.push({
          id: this.generateId(),
          shortName: `Link_${address}`,
          physicalAddress: address,
          ecuVariantRef: ecuVariant.id
        })
      }
    }

    return vehicle
  }

  /**
   * Export to ODX-D format (ECU variant data)
   */
  exportODXD(ecuVariant: ODXECUVariant): string {
    const odxd = {
      'ODX': {
        '@xmlns': 'http://www.asam.net/xml/odx',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@MODEL-VERSION': '2.2.0',
        'DIAG-LAYER-CONTAINER': {
          'ECU-VARIANT': {
            '@ID': ecuVariant.id,
            'SHORT-NAME': ecuVariant.shortName,
            'LONG-NAME': ecuVariant.longName,
            'PHYSICAL-ADDRESS': ecuVariant.ecuAddress,
            'DIAG-DATA-DICTIONARY-SPEC': {
              'DTCS': {
                'DTC': ecuVariant.dtcs.map(dtc => ({
                  '@ID': dtc.id,
                  'SHORT-NAME': dtc.shortName,
                  'LONG-NAME': dtc.longName,
                  'TROUBLE-CODE': dtc.dtcNumber,
                  'DISPLAY-TROUBLE-CODE': dtc.displayTroubleCode,
                  'TEXT': dtc.text,
                  'LEVEL': dtc.level
                }))
              },
              'DATA-OBJECT-PROPS': {
                'DATA-OBJECT-PROP': ecuVariant.dids.map(did => ({
                  '@ID': did.id,
                  'SHORT-NAME': did.shortName,
                  'LONG-NAME': did.longName,
                  'COMPU-METHOD': {
                    'CATEGORY': 'IDENTICAL'
                  },
                  'DIAG-CODED-TYPE': {
                    '@BASE-DATA-TYPE': did.dataType || 'A_UINT32',
                    'BIT-LENGTH': (did.dataLength || 1) * 8
                  }
                }))
              }
            },
            'DIAG-COMMS': {
              'DIAG-SERVICE': ecuVariant.diagServices.map(service => ({
                '@ID': service.id,
                'SHORT-NAME': service.shortName,
                'LONG-NAME': service.longName,
                'ADDRESSING': service.addressing,
                'REQUEST': {
                  '@ID': `${service.id}_RQ`,
                  'SHORT-NAME': `${service.shortName}_Request`
                },
                'POS-RESPONSE': {
                  '@ID': `${service.id}_PR`,
                  'SHORT-NAME': `${service.shortName}_PositiveResponse`
                },
                'NEG-RESPONSE': {
                  '@ID': `${service.id}_NR`,
                  'SHORT-NAME': `${service.shortName}_NegativeResponse`
                }
              }))
            }
          }
        }
      }
    }

    return JSON.stringify(odxd, null, 2)
  }

  /**
   * Export to ODX-V format (vehicle topology)
   */
  exportODXV(vehicle: ODXVehicle): string {
    const odxv = {
      'ODX': {
        '@xmlns': 'http://www.asam.net/xml/odx',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@MODEL-VERSION': '2.2.0',
        'VEHICLE-INFORMATION-SPEC': {
          'VEHICLE-INFORMATIONS': {
            'VEHICLE-INFORMATION': {
              '@ID': vehicle.id,
              'SHORT-NAME': vehicle.shortName,
              'LONG-NAME': vehicle.longName,
              'VEHICLE-CONNECTORS': {
                'VEHICLE-CONNECTOR': {
                  '@ID': `${vehicle.id}_CONN`,
                  'SHORT-NAME': 'OBD_Connector',
                  'LONG-NAME': 'OBD-II Connector',
                  'PIN-NUMBER': '16'
                }
              },
              'LOGICAL-LINKS': {
                'LOGICAL-LINK': vehicle.logicalLinks.map(link => ({
                  '@ID': link.id,
                  'SHORT-NAME': link.shortName,
                  'PHYSICAL-VEHICLE-LINK-REF': {
                    '@ID-REF': `${vehicle.id}_CONN`
                  },
                  'PROTOCOL-REF': {
                    '@ID-REF': 'ISO_14229_UDS'
                  },
                  'PROT-PHYSICAL-ADDRESS': link.physicalAddress,
                  'ECU-VARIANT-REF': {
                    '@ID-REF': link.ecuVariantRef
                  }
                }))
              }
            }
          }
        }
      }
    }

    return JSON.stringify(odxv, null, 2)
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ODX_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get current project
   */
  getProject(): ODXProject {
    return this.project
  }

  /**
   * Update project with new discovery data
   */
  updateFromDiscovery(
    ecus: Map<string, ECUInfo>,
    messages: UDSMessage[]
  ): ODXProject {
    // Merge new discoveries with existing data
    for (const [address, ecuInfo] of ecus) {
      const existingVariant = this.ecuVariantMap.get(address)

      if (existingVariant) {
        // Update existing ECU variant
        this.mergeECUVariant(existingVariant, ecuInfo, messages)
      } else {
        // Add new ECU variant
        const newVariant = this.createECUVariant(address, ecuInfo, messages)
        this.ecuVariantMap.set(address, newVariant)
        this.project.ecuVariants.push(newVariant)
      }
    }

    this.project.updatedAt = new Date()
    return this.project
  }

  /**
   * Merge new discoveries into existing ECU variant
   */
  private mergeECUVariant(
    existing: ODXECUVariant,
    ecuInfo: ECUInfo,
    messages: UDSMessage[]
  ): void {
    const ecuMessages = messages.filter(
      msg => msg.target === existing.ecuAddress || msg.source === existing.ecuAddress
    )

    // Merge services
    const newServices = this.extractDiagServices(ecuInfo, ecuMessages)
    for (const newService of newServices) {
      const exists = existing.diagServices.find(
        s => s.requestSID === newService.requestSID
      )
      if (!exists) {
        existing.diagServices.push(newService)
      }
    }

    // Merge DTCs
    const newDTCs = this.extractDTCs(ecuInfo, ecuMessages)
    for (const newDTC of newDTCs) {
      const exists = existing.dtcs.find(d => d.dtcNumber === newDTC.dtcNumber)
      if (!exists) {
        existing.dtcs.push(newDTC)
      }
    }

    // Merge DIDs
    const newDIDs = this.extractDIDs(ecuInfo, ecuMessages)
    for (const newDID of newDIDs) {
      const exists = existing.dids.find(d => d.dataIdentifier === newDID.dataIdentifier)
      if (!exists) {
        existing.dids.push(newDID)
      }
    }

    // Merge routines
    const newRoutines = this.extractRoutines(ecuInfo, ecuMessages)
    for (const newRoutine of newRoutines) {
      const exists = existing.routines.find(
        r => r.routineIdentifier === newRoutine.routineIdentifier
      )
      if (!exists) {
        existing.routines.push(newRoutine)
      }
    }
  }
}

export default ODXBuilder