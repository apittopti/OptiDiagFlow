/**
 * ODX Data Object Property (DOP) Templates
 * Based on real ODX examples from automotive industry
 * These templates define how to decode raw diagnostic data
 */

export interface DOPTemplate {
  id: string
  shortName: string
  longName: string
  dataIdentifier?: string // e.g., 'F190' for VIN
  baseDataType: string
  encoding?: string // e.g., 'BCD-P', 'ASCII', 'HEX'
  bitLength: number
  scale?: number
  offset?: number
  unit?: string
  category: string
  description?: string
}

// Convert hex DID to decimal for ODX (e.g., 0xF190 = 61840)
const didToDecimal = (hex: string) => parseInt(hex, 16).toString()

/**
 * Common UDS Data Identifiers (DIDs) as per ISO 14229
 * These are standard across the automotive industry
 */
export const STANDARD_DOP_TEMPLATES: DOPTemplate[] = [
  // ===== VEHICLE IDENTIFICATION =====
  {
    id: 'DOP_VIN',
    shortName: 'VIN',
    longName: 'Vehicle Identification Number',
    dataIdentifier: 'F190',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 136, // 17 bytes
    category: 'Vehicle Identification',
    description: '17-character vehicle identification number'
  },
  {
    id: 'DOP_VIN_ORIGINAL',
    shortName: 'VIN_Original',
    longName: 'Original Vehicle Identification Number',
    dataIdentifier: 'F19E',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 136,
    category: 'Vehicle Identification'
  },

  // ===== ECU IDENTIFICATION =====
  {
    id: 'DOP_ECU_SERIAL_NUMBER',
    shortName: 'ECU_SerialNumber',
    longName: 'ECU Serial Number',
    dataIdentifier: 'F18C',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 128, // Variable, typically 16 bytes
    category: 'ECU Identification'
  },
  {
    id: 'DOP_ECU_PART_NUMBER',
    shortName: 'ECU_PartNumber',
    longName: 'ECU Part Number',
    dataIdentifier: 'F187',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 88, // 11 bytes typical
    category: 'ECU Identification'
  },
  {
    id: 'DOP_ECU_HARDWARE_NUMBER',
    shortName: 'ECU_HardwareNumber',
    longName: 'ECU Hardware Number',
    dataIdentifier: 'F191',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 80, // 10 bytes
    category: 'ECU Identification'
  },
  {
    id: 'DOP_ECU_SOFTWARE_NUMBER',
    shortName: 'ECU_SoftwareNumber',
    longName: 'ECU Software Number',
    dataIdentifier: 'F188',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 80,
    category: 'ECU Identification'
  },
  {
    id: 'DOP_ECU_HARDWARE_VERSION',
    shortName: 'ECU_HardwareVersion',
    longName: 'ECU Hardware Version',
    dataIdentifier: 'F193',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 32, // 4 bytes
    category: 'ECU Identification'
  },
  {
    id: 'DOP_ECU_SOFTWARE_VERSION',
    shortName: 'ECU_SoftwareVersion',
    longName: 'ECU Software Version',
    dataIdentifier: 'F189',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 32,
    category: 'ECU Identification'
  },

  // ===== SUPPLIER INFORMATION =====
  {
    id: 'DOP_SYSTEM_SUPPLIER_ID',
    shortName: 'SystemSupplierID',
    longName: 'System Supplier Identifier',
    dataIdentifier: 'F18A',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 40, // 5 bytes
    category: 'Supplier Information'
  },
  {
    id: 'DOP_SYSTEM_SUPPLIER_CODE',
    shortName: 'SystemSupplierCode',
    longName: 'System Supplier Specific ECU Software Number',
    dataIdentifier: 'F192',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 80,
    category: 'Supplier Information'
  },
  {
    id: 'DOP_MANUFACTURER_SPARE_PART',
    shortName: 'ManufacturerSparePart',
    longName: 'Vehicle Manufacturer Spare Part Number',
    dataIdentifier: 'F187',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 104, // 13 bytes
    category: 'Supplier Information'
  },

  // ===== DATE INFORMATION =====
  {
    id: 'DOP_ECU_MANUFACTURING_DATE',
    shortName: 'ECU_ManufacturingDate',
    longName: 'ECU Manufacturing Date',
    dataIdentifier: 'F18B',
    baseDataType: 'A_UINT32',
    encoding: 'BCD-P', // BCD encoded YYYYMMDD
    bitLength: 32, // 4 bytes
    category: 'Date Information',
    description: 'Format: YYYYMMDD in BCD'
  },
  {
    id: 'DOP_PROGRAMMING_DATE',
    shortName: 'ProgrammingDate',
    longName: 'ECU Programming Date',
    dataIdentifier: 'F199',
    baseDataType: 'A_UINT32',
    encoding: 'BCD-P',
    bitLength: 32,
    category: 'Date Information',
    description: 'Format: YYYYMMDD in BCD'
  },
  {
    id: 'DOP_INSTALL_DATE',
    shortName: 'InstallDate',
    longName: 'ECU Installation Date',
    dataIdentifier: 'F19D',
    baseDataType: 'A_UINT32',
    encoding: 'BCD-P',
    bitLength: 32,
    category: 'Date Information'
  },

  // ===== DIAGNOSTIC SESSION =====
  {
    id: 'DOP_ACTIVE_DIAGNOSTIC_SESSION',
    shortName: 'ActiveDiagSession',
    longName: 'Active Diagnostic Session Data Identifier',
    dataIdentifier: 'F186',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    category: 'Diagnostic Session',
    description: '01=Default, 02=Programming, 03=Extended'
  },

  // ===== VEHICLE SPEED & ODOMETER =====
  {
    id: 'DOP_VEHICLE_SPEED',
    shortName: 'VehicleSpeed',
    longName: 'Vehicle Speed',
    dataIdentifier: 'F40D',
    baseDataType: 'A_UINT32',
    bitLength: 16,
    scale: 0.01,
    offset: 0,
    unit: 'km/h',
    category: 'Vehicle Dynamics'
  },
  {
    id: 'DOP_ODOMETER',
    shortName: 'Odometer',
    longName: 'Odometer Value',
    dataIdentifier: 'F194',
    baseDataType: 'A_UINT32',
    bitLength: 24,
    scale: 1,
    offset: 0,
    unit: 'km',
    category: 'Vehicle Dynamics'
  },

  // ===== ENGINE PARAMETERS =====
  {
    id: 'DOP_ENGINE_SPEED',
    shortName: 'EngineSpeed',
    longName: 'Engine Speed',
    dataIdentifier: 'F40C',
    baseDataType: 'A_UINT32',
    bitLength: 16,
    scale: 0.25,
    offset: 0,
    unit: 'rpm',
    category: 'Engine Parameters'
  },
  {
    id: 'DOP_ENGINE_COOLANT_TEMP',
    shortName: 'EngineCoolantTemp',
    longName: 'Engine Coolant Temperature',
    dataIdentifier: 'F405',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    scale: 1,
    offset: -40,
    unit: '°C',
    category: 'Engine Parameters'
  },
  {
    id: 'DOP_ENGINE_OIL_TEMP',
    shortName: 'EngineOilTemp',
    longName: 'Engine Oil Temperature',
    dataIdentifier: 'F42E',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    scale: 1,
    offset: -40,
    unit: '°C',
    category: 'Engine Parameters'
  },
  {
    id: 'DOP_FUEL_LEVEL',
    shortName: 'FuelLevel',
    longName: 'Fuel Level Input',
    dataIdentifier: 'F42F',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    scale: 0.392157, // 100/255
    offset: 0,
    unit: '%',
    category: 'Engine Parameters'
  },

  // ===== BATTERY & ELECTRICAL =====
  {
    id: 'DOP_BATTERY_VOLTAGE',
    shortName: 'BatteryVoltage',
    longName: 'Battery Voltage',
    dataIdentifier: 'F412',
    baseDataType: 'A_UINT32',
    bitLength: 16,
    scale: 0.001,
    offset: 0,
    unit: 'V',
    category: 'Electrical System'
  },
  {
    id: 'DOP_BATTERY_STATE_OF_CHARGE',
    shortName: 'BatterySOC',
    longName: 'Battery State of Charge',
    dataIdentifier: 'F434',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    scale: 0.5,
    offset: 0,
    unit: '%',
    category: 'Electrical System'
  },

  // ===== DTC INFORMATION =====
  {
    id: 'DOP_DTC_COUNT',
    shortName: 'DTCCount',
    longName: 'Number of DTCs',
    dataIdentifier: 'F101',
    baseDataType: 'A_UINT32',
    bitLength: 8,
    category: 'DTC Information'
  },
  {
    id: 'DOP_DTC_BY_STATUS_MASK',
    shortName: 'DTCByStatusMask',
    longName: 'DTC By Status Mask',
    baseDataType: 'A_BYTEFIELD',
    bitLength: 24, // 3 bytes for standard DTC
    category: 'DTC Information',
    description: 'Format: [DTC High][DTC Low][Status]'
  },

  // ===== NETWORK CONFIGURATION =====
  {
    id: 'DOP_DOIP_ENTITY_ADDRESS',
    shortName: 'DoIPEntityAddress',
    longName: 'DoIP Entity Logical Address',
    dataIdentifier: 'FD00',
    baseDataType: 'A_UINT32',
    bitLength: 16,
    category: 'Network Configuration'
  },
  {
    id: 'DOP_CAN_NODE_ID',
    shortName: 'CANNodeID',
    longName: 'CAN Node Identifier',
    dataIdentifier: 'FD01',
    baseDataType: 'A_UINT32',
    bitLength: 32,
    category: 'Network Configuration'
  },

  // ===== BOOTLOADER =====
  {
    id: 'DOP_BOOTLOADER_VERSION',
    shortName: 'BootloaderVersion',
    longName: 'Boot Software Identification',
    dataIdentifier: 'F180',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 128, // Variable
    category: 'Bootloader'
  },
  {
    id: 'DOP_APPLICATION_VERSION',
    shortName: 'ApplicationVersion',
    longName: 'Application Software Identification',
    dataIdentifier: 'F181',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 128,
    category: 'Bootloader'
  },

  // ===== CALIBRATION DATA =====
  {
    id: 'DOP_CALIBRATION_VERSION',
    shortName: 'CalibrationVersion',
    longName: 'Calibration Software Identification',
    dataIdentifier: 'F182',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 128,
    category: 'Calibration'
  },
  {
    id: 'DOP_CALIBRATION_VERIFICATION',
    shortName: 'CalibrationVerification',
    longName: 'Calibration Repair Shop Code or Serial Number',
    dataIdentifier: 'F19A',
    baseDataType: 'A_ASCIISTRING',
    bitLength: 216, // 27 bytes
    category: 'Calibration'
  }
]

/**
 * Get DOP template by Data Identifier
 */
export function getDOPTemplateByDID(did: string): DOPTemplate | undefined {
  const normalizedDID = did.toUpperCase().replace('0X', '')
  return STANDARD_DOP_TEMPLATES.find(t => t.dataIdentifier === normalizedDID)
}

/**
 * Decode raw data using DOP template
 */
export function decodeWithDOP(rawData: string, dop: DOPTemplate): any {
  const bytes = rawData.match(/.{1,2}/g) || []

  switch (dop.baseDataType) {
    case 'A_ASCIISTRING':
      // Convert hex to ASCII string
      return bytes.map(b => String.fromCharCode(parseInt(b, 16))).join('')

    case 'A_UINT32':
      // Convert to unsigned integer
      let value = parseInt(bytes.join(''), 16)

      // Apply BCD decoding if needed
      if (dop.encoding === 'BCD-P') {
        value = parseInt(bytes.map(b => b).join(''))
      }

      // Apply scale and offset
      if (dop.scale) value *= dop.scale
      if (dop.offset) value += dop.offset

      return dop.unit ? `${value} ${dop.unit}` : value

    case 'A_BYTEFIELD':
      // Keep as hex string
      return rawData

    default:
      return rawData
  }
}

/**
 * Format decoded value for display
 */
export function formatDecodedValue(value: any, dop: DOPTemplate): string {
  if (dop.unit && typeof value === 'number') {
    return `${value.toFixed(2)} ${dop.unit}`
  }
  return String(value)
}

/**
 * Categories for grouping DOPs in UI
 */
export const DOP_CATEGORIES = [
  'Vehicle Identification',
  'ECU Identification',
  'Supplier Information',
  'Date Information',
  'Diagnostic Session',
  'Vehicle Dynamics',
  'Engine Parameters',
  'Electrical System',
  'DTC Information',
  'Network Configuration',
  'Bootloader',
  'Calibration'
]

/**
 * Common encoding types
 */
export const ENCODING_TYPES = [
  { value: 'NONE', label: 'None (Raw)' },
  { value: 'BCD-P', label: 'BCD Packed' },
  { value: 'BCD-UP', label: 'BCD Unpacked' },
  { value: 'ASCII', label: 'ASCII String' },
  { value: 'UTF8', label: 'UTF-8 String' },
  { value: 'HEX', label: 'Hexadecimal' },
  { value: 'SIGNED-BE', label: 'Signed Big-Endian' },
  { value: 'SIGNED-LE', label: 'Signed Little-Endian' },
  { value: 'IEEE-754', label: 'IEEE 754 Float' }
]