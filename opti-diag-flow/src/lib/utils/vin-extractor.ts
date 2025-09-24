/**
 * VIN Extraction and Validation Utilities
 *
 * Extracts VIN from multiple sources with priority hierarchy:
 * 1. User-provided VIN (from vehicle record)
 * 2. Metadata VIN (from trace file metadata)
 * 3. UDS DID F190 (standard VIN DID)
 * 4. EOBD Mode 09 PID 02 (OBD-II VIN)
 * 5. Other DIDs that might contain VIN
 */

export interface VINSource {
  vin: string
  source: 'user' | 'metadata' | 'uds_f190' | 'eobd_0902' | 'did_other'
  confidence: 'high' | 'medium' | 'low'
  ecuName?: string
  raw?: string
}

/**
 * Validates a VIN string
 * Standard VIN is 17 characters: [A-HJ-NPR-Z0-9]{17}
 * (I, O, Q are not used to avoid confusion with 1, 0, Q)
 */
export function validateVIN(vin: string): boolean {
  if (!vin) return false

  // Remove any whitespace or non-printable characters
  const cleanVIN = vin.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  // Standard VIN regex - 17 alphanumeric characters, excluding I, O, Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i

  return vinRegex.test(cleanVIN)
}

/**
 * Cleans VIN string from hex or ASCII encoding artifacts
 */
export function cleanVIN(raw: string): string {
  if (!raw) return ''

  let vin = raw

  // If it's hex encoded (starts with 0x or looks like hex pairs)
  if (raw.startsWith('0x')) {
    vin = raw.substring(2)
  }

  // Try to decode if it looks like hex pairs (e.g., "57 41 55 5A...")
  if (/^([0-9A-Fa-f]{2}\s*)+$/.test(vin)) {
    const hexPairs = vin.match(/[0-9A-Fa-f]{2}/g) || []
    vin = hexPairs.map(hex => String.fromCharCode(parseInt(hex, 16))).join('')
  }

  // Remove non-printable characters and trim
  vin = vin.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()

  // Sometimes VIN is padded with spaces or zeros
  vin = vin.replace(/\s+$/, '').replace(/^0+/, '')

  // Extract 17-character VIN if embedded in longer string
  const vinMatch = vin.match(/[A-HJ-NPR-Z0-9]{17}/i)
  if (vinMatch) {
    return vinMatch[0].toUpperCase()
  }

  return vin.toUpperCase()
}

/**
 * Extract VIN from job data with source priority
 */
export function extractVINWithSource(job: any): VINSource | null {
  const vinSources: VINSource[] = []

  // 1. User-provided VIN (highest priority - user explicitly entered)
  if (job.Vehicle?.vin) {
    const cleanedVIN = cleanVIN(job.Vehicle.vin)
    if (validateVIN(cleanedVIN)) {
      vinSources.push({
        vin: cleanedVIN,
        source: 'user',
        confidence: 'high',
        raw: job.Vehicle.vin
      })
    }
  }

  // 2. Metadata VIN (from trace file metadata)
  if (job.metadata?.vehicleVIN) {
    const cleanedVIN = cleanVIN(job.metadata.vehicleVIN)
    if (validateVIN(cleanedVIN)) {
      vinSources.push({
        vin: cleanedVIN,
        source: 'metadata',
        confidence: 'high',
        raw: job.metadata.vehicleVIN
      })
    }
  }

  // 3. UDS DID F190 (standard VIN DID)
  if (job.DataIdentifier && job.DataIdentifier.length > 0) {
    const vinDIDs = job.DataIdentifier.filter((did: any) =>
      did.did === 'F190' ||
      did.did === 'f190' ||
      did.name?.toLowerCase().includes('vin')
    )

    for (const did of vinDIDs) {
      if (did.sampleValues && did.sampleValues.length > 0) {
        for (const sample of did.sampleValues) {
          const cleanedVIN = cleanVIN(sample)
          if (validateVIN(cleanedVIN)) {
            vinSources.push({
              vin: cleanedVIN,
              source: did.did.toUpperCase() === 'F190' ? 'uds_f190' : 'did_other',
              confidence: did.did.toUpperCase() === 'F190' ? 'high' : 'medium',
              ecuName: did.ecuName,
              raw: sample
            })
            break // Use first valid VIN from this DID
          }
        }
      }
    }
  }

  // 4. EOBD Mode 09 PID 02 (if EOBD data available)
  // This would be in messages with service 0x09 and PID 0x02
  // Format: 09 02 -> response contains VIN
  if (job.metadata?.messages) {
    const eobdVINMessages = job.metadata.messages.filter((msg: any) =>
      msg.data &&
      (msg.data.startsWith('0902') || msg.data.startsWith('0x0902') ||
       msg.data.startsWith('09 02') ||
       msg.data.startsWith('4902') || msg.data.startsWith('0x4902') ||
       (msg.data.startsWith('49') && msg.data.includes('02')) ||
       (msg.data.startsWith('0x49') && msg.data.includes('02'))) // Response to mode 09
    )

    for (const msg of eobdVINMessages) {
      // EOBD VIN response format: 49 02 01 [VIN bytes]
      // The VIN starts at byte 5 of the response
      let vinData = msg.data.replace(/\s/g, '')

      // Remove 0x prefix if present
      if (vinData.startsWith('0x') || vinData.startsWith('0X')) {
        vinData = vinData.substring(2)
      }

      if (vinData.startsWith('490201') || vinData.startsWith('490202')) {
        vinData = vinData.substring(6) // Skip header (490201 or 490202)
        const cleanedVIN = cleanVIN(vinData)
        if (validateVIN(cleanedVIN)) {
          vinSources.push({
            vin: cleanedVIN,
            source: 'eobd_0902',
            confidence: 'high',
            ecuName: msg.source,
            raw: msg.data
          })
          break
        }
      }
    }
  }

  // Return the highest priority valid VIN
  if (vinSources.length > 0) {
    // Sort by priority: user > metadata > uds_f190 > eobd_0902 > did_other
    const priorityMap = {
      'user': 1,
      'metadata': 2,
      'uds_f190': 3,
      'eobd_0902': 4,
      'did_other': 5
    }

    vinSources.sort((a, b) => {
      const priorityDiff = priorityMap[a.source] - priorityMap[b.source]
      if (priorityDiff !== 0) return priorityDiff

      // If same source, prefer high confidence
      const confidenceMap = { 'high': 1, 'medium': 2, 'low': 3 }
      return confidenceMap[a.confidence] - confidenceMap[b.confidence]
    })

    return vinSources[0]
  }

  return null
}

/**
 * Format VIN source for display
 */
export function formatVINSource(source: VINSource): string {
  const sourceLabels = {
    'user': 'User Provided',
    'metadata': 'Trace Metadata',
    'uds_f190': 'UDS DID F190',
    'eobd_0902': 'EOBD Mode 09',
    'did_other': 'Diagnostic DID'
  }

  let label = sourceLabels[source.source] || source.source
  if (source.ecuName) {
    label += ` (${source.ecuName})`
  }

  return label
}

/**
 * Get VIN badge color based on source
 */
export function getVINSourceColor(source: VINSource): 'success' | 'info' | 'warning' {
  switch (source.source) {
    case 'user':
    case 'uds_f190':
    case 'eobd_0902':
      return 'success'
    case 'metadata':
      return 'info'
    case 'did_other':
      return 'warning'
    default:
      return 'info'
  }
}