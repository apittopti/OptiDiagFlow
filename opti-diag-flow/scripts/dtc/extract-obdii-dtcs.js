const fs = require('fs');
const path = require('path');

// Read the jobs page file
const filePath = path.join(__dirname, 'src', 'app', 'jobs', '[id]', 'page.tsx');
const fileContent = fs.readFileSync(filePath, 'utf-8');

// Extract the obdiiDTCs object
const startPattern = /const obdiiDTCs.*=\s*{/;
const match = fileContent.match(startPattern);

if (!match) {
  console.error('Could not find obdiiDTCs object');
  process.exit(1);
}

const startIndex = match.index;
let braceCount = 0;
let inObject = false;
let endIndex = startIndex;

// Find the closing brace of the object
for (let i = startIndex; i < fileContent.length; i++) {
  const char = fileContent[i];

  if (char === '{') {
    braceCount++;
    inObject = true;
  } else if (char === '}') {
    braceCount--;
    if (inObject && braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
}

const obdiiDTCsString = fileContent.substring(startIndex, endIndex);

// Parse the DTCs using eval (safe since we control the source)
const obdiiDTCs = eval('(' + obdiiDTCsString.replace(/const obdiiDTCs.*=/, '') + ')');

// Categorize DTCs by type
const categorizedDTCs = [];

Object.entries(obdiiDTCs).forEach(([code, description]) => {
  let system = 'Powertrain';
  let isGeneric = true;
  let category = '';

  // Determine system based on first letter
  const firstChar = code[0];
  switch(firstChar) {
    case 'P':
      system = 'Powertrain';
      break;
    case 'B':
      system = 'Body';
      break;
    case 'C':
      system = 'Chassis';
      break;
    case 'U':
      system = 'Network';
      break;
  }

  // Determine if generic or manufacturer specific
  const secondChar = code[1];
  isGeneric = (secondChar === '0' || secondChar === '2');

  // Categorize based on code ranges
  if (code.startsWith('P0')) {
    if (code >= 'P0100' && code <= 'P0199') category = 'Fuel and Air Metering';
    else if (code >= 'P0200' && code <= 'P0299') category = 'Fuel and Air Metering (Injector Circuit)';
    else if (code >= 'P0300' && code <= 'P0399') category = 'Ignition System or Misfire';
    else if (code >= 'P0400' && code <= 'P0499') category = 'Auxiliary Emission Controls';
    else if (code >= 'P0500' && code <= 'P0599') category = 'Vehicle Speed Controls and Idle Control System';
    else if (code >= 'P0600' && code <= 'P0699') category = 'Computer Output Circuit';
    else if (code >= 'P0700' && code <= 'P0799') category = 'Transmission';
    else if (code >= 'P0800' && code <= 'P0899') category = 'Transmission';
    else if (code >= 'P0900' && code <= 'P0999') category = 'Transmission';
    else if (code >= 'P0001' && code <= 'P0099') category = 'Fuel and Air Metering and Auxiliary Emission Controls';
  } else if (code.startsWith('P1')) {
    category = 'Manufacturer Specific';
  } else if (code.startsWith('B')) {
    category = 'Airbag and Supplemental Restraint Systems';
  } else if (code.startsWith('C')) {
    category = 'ABS and Traction Control';
  } else if (code.startsWith('U0')) {
    if (code >= 'U0001' && code <= 'U0099') category = 'CAN Communication';
    else if (code >= 'U0100' && code <= 'U0199') category = 'Lost Communication with Module';
  } else if (code.startsWith('U1')) {
    category = 'Manufacturer Specific Network Communication';
  }

  categorizedDTCs.push({
    code,
    name: description.substring(0, 100), // Limit name to 100 chars
    description,
    system,
    isGeneric,
    category
  });
});

// Sort by code
categorizedDTCs.sort((a, b) => a.code.localeCompare(b.code));

// Generate the seed file content
const seedContent = `// OBD-II DTC definitions seed file
// Generated from hardcoded DTCs in the application
// Total DTCs: ${categorizedDTCs.length}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function seedOBDIIDTCs() {
  console.log('Seeding OBD-II DTC definitions...')

  const dtcs = ${JSON.stringify(categorizedDTCs, null, 2)}

  let created = 0
  let skipped = 0

  for (const dtc of dtcs) {
    try {
      const existing = await prisma.oBDIIDTCDefinition.findUnique({
        where: { code: dtc.code }
      })

      if (existing) {
        console.log(\`Skipping existing DTC: \${dtc.code}\`)
        skipped++
      } else {
        await prisma.oBDIIDTCDefinition.create({
          data: {
            code: dtc.code,
            name: dtc.name,
            description: dtc.description,
            system: dtc.system,
            isGeneric: dtc.isGeneric,
            category: dtc.category
          }
        })
        created++
      }
    } catch (error) {
      console.error(\`Error creating DTC \${dtc.code}:\`, error.message)
    }
  }

  console.log(\`OBD-II DTCs seeded: \${created} created, \${skipped} skipped\`)
}

module.exports = { seedOBDIIDTCs }

// Allow running directly
if (require.main === module) {
  seedOBDIIDTCs()
    .then(async () => {
      await prisma.$disconnect()
      console.log('Seed completed')
    })
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
`;

// Write the seed file
const seedFilePath = path.join(__dirname, 'prisma', 'seed-obdii-dtcs.js');
fs.writeFileSync(seedFilePath, seedContent);

console.log(`✅ Successfully extracted ${Object.keys(obdiiDTCs).length} OBD-II DTCs`);
console.log(`📝 Seed file created at: ${seedFilePath}`);

// Also create a JSON file for reference
const jsonPath = path.join(__dirname, 'obdii-dtcs.json');
fs.writeFileSync(jsonPath, JSON.stringify(categorizedDTCs, null, 2));
console.log(`📊 JSON reference file created at: ${jsonPath}`);