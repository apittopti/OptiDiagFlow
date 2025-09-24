// Test the ISO-TP parsing logic
function parseISOTP(data) {
  // Remove 0x prefix if present
  const hex = data.trim().replace(/^0x/i, '').toUpperCase()

  if (hex.length < 2) {
    return { hasISOTP: false, cleanData: hex }
  }

  const firstByte = parseInt(hex.substring(0, 2), 16)
  console.log(`  First byte: ${hex.substring(0, 2)} = 0x${firstByte.toString(16)} (${firstByte} decimal)`)

  // ISO-TP single frames (0x01-0x07)
  if (firstByte >= 0x01 && firstByte <= 0x07) {
    const length = firstByte
    const dataStart = 2
    const dataEnd = dataStart + (length * 2)
    const cleanData = hex.substring(dataStart, dataEnd)
    console.log(`  -> ISO-TP single frame, length=${length}, cleanData=${cleanData}`)
    return { hasISOTP: true, cleanData, actualLength: length }
  }

  // Not ISO-TP
  console.log(`  -> Not ISO-TP, returning as-is`)
  return { hasISOTP: false, cleanData: hex }
}

function decodeUDSMessage(data) {
  console.log(`\nProcessing: ${data}`)

  // Skip empty or invalid data
  if (!data || data.trim().length < 2) {
    return { service: '', dataBytes: '', description: '' }
  }

  let cleanData = data.trim().replace(/^0x/i, '').toUpperCase()
  console.log(`  After removing 0x: ${cleanData}`)

  // Check for ISO-TP framing
  const isotpResult = parseISOTP(data)
  cleanData = isotpResult.cleanData
  console.log(`  After ISO-TP check: ${cleanData}`)

  if (!cleanData || cleanData.length < 2) {
    return { service: '', dataBytes: '', description: '' }
  }

  // Now extract the actual UDS/OBD-II service ID
  const serviceId = cleanData.substring(0, 2).toUpperCase()
  const dataBytes = cleanData.length > 2 ? cleanData.substring(2) : ''

  console.log(`  Service ID: ${serviceId}`)
  console.log(`  Data bytes: ${dataBytes}`)

  return { service: serviceId, dataBytes, description: '' }
}

// Test cases from the actual data
const testCases = [
  '0x3103F00301',      // Should be service 31 (Routine Control)
  '0x190208',          // Should be service 19 (Read DTC)
  '0x2712D49A7B24186245C9', // Should be service 27 (Security Access)
  '0x033101AA',        // ISO-TP single frame with 3 bytes, containing service 31
  '0x0731010203040506' // ISO-TP single frame with 7 bytes, containing service 31
]

console.log('Testing UDS message parsing:')
console.log('============================')

testCases.forEach(testData => {
  const result = decodeUDSMessage(testData)
  console.log(`\nResult: Service=${result.service} (expected from message content)`)
  console.log('---')
})