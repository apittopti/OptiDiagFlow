const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Function to convert hex DTC codes to SAE J2012 format
function convertToSAEFormat(hexCode) {
  try {
    // Remove any non-hex characters and ensure uppercase
    const cleanCode = hexCode.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()

    // Need at least 4 hex characters (2 bytes) for a valid DTC
    if (cleanCode.length < 4) return hexCode // Return original if invalid

    // Use first 4 characters (2 bytes) for the code
    const codeBytes = cleanCode.substring(0, 4)

    const byte1 = parseInt(codeBytes.substring(0, 2), 16)
    const byte2 = parseInt(codeBytes.substring(2, 4), 16)

    // Skip if invalid bytes
    if (isNaN(byte1) || isNaN(byte2)) return hexCode

    // SAE J2012 DTC format conversion:
    // Byte 1 bits 7-6 determine the letter (P/C/B/U)
    // Byte 1 bits 5-4 determine the first digit (0-3)
    // Byte 1 bits 3-0 is the second digit (hex)
    // Byte 2 bits 7-4 is the third digit (hex)
    // Byte 2 bits 3-0 is the fourth digit (hex)

    const letterBits = (byte1 >> 6) & 0x03
    const firstDigitBits = (byte1 >> 4) & 0x03
    const secondDigit = byte1 & 0x0F
    const thirdDigit = (byte2 >> 4) & 0x0F
    const fourthDigit = byte2 & 0x0F

    // Determine the letter based on bits 7-6
    let letter
    switch (letterBits) {
      case 0: letter = 'P'; break  // Powertrain
      case 1: letter = 'C'; break  // Chassis
      case 2: letter = 'B'; break  // Body
      case 3: letter = 'U'; break  // Network/Communication
      default: letter = 'P'; break
    }

    // Build the DTC code in SAE J2012 format
    const dtcCode = `${letter}${firstDigitBits}${secondDigit.toString(16).toUpperCase()}${thirdDigit.toString(16).toUpperCase()}${fourthDigit.toString(16).toUpperCase()}`

    return dtcCode
  } catch (error) {
    console.error(`Error converting DTC code ${hexCode}:`, error)
    return hexCode // Return original on error
  }
}

async function migrateDTCCodes() {
  try {
    // Get all DTCs
    const dtcs = await prisma.dTC.findMany()

    console.log(`Found ${dtcs.length} DTCs to migrate`)

    let migratedCount = 0

    for (const dtc of dtcs) {
      // Check if the code is already in SAE format (starts with P, C, B, or U)
      if (/^[PCBU][0-9A-F]{4}$/i.test(dtc.code)) {
        console.log(`DTC ${dtc.code} is already in SAE format, skipping`)
        continue
      }

      // Convert hex code to SAE format
      const newCode = convertToSAEFormat(dtc.code)

      if (newCode !== dtc.code) {
        console.log(`Migrating DTC: ${dtc.code} -> ${newCode}`)

        await prisma.dTC.update({
          where: { id: dtc.id },
          data: { code: newCode }
        })

        migratedCount++
      } else {
        console.log(`Could not convert DTC ${dtc.code}, keeping original`)
      }
    }

    console.log(`\nMigration complete! Migrated ${migratedCount} DTCs`)
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration
migrateDTCCodes()