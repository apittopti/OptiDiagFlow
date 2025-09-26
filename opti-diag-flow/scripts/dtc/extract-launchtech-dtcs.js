const fs = require('fs');

function extractDTCs() {
  console.log('Extracting DTCs from Launch Tech HTML...');

  try {
    const html = fs.readFileSync('launchtech-page.html', 'utf8');

    const dtcs = [];

    // Regular expression to match DTC codes and descriptions
    // Matches patterns like "P0010 Description" or "P0010 - Description"
    const regex = /([PBCU]\d{4})\s*[-–]?\s*([^<\n]+?)(?=<|$)/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const code = match[1];
      const description = match[2].trim()
        .replace(/&amp;/g, '&')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
        .trim();

      if (code && description && description.length > 0) {
        const prefix = code[0];
        let system = 'Unknown';
        let isGeneric = false;

        // Determine system based on code prefix
        if (prefix === 'P') {
          system = 'Powertrain';
          // P0xxx and P2xxx are generic
          const codeNum = parseInt(code.substring(1));
          isGeneric = (codeNum < 1000) || (codeNum >= 2000 && codeNum < 3000);
        } else if (prefix === 'B') {
          system = 'Body';
          isGeneric = code.substring(1, 2) === '0';
        } else if (prefix === 'C') {
          system = 'Chassis';
          isGeneric = code.substring(1, 2) === '0';
        } else if (prefix === 'U') {
          system = 'Network';
          isGeneric = code.substring(1, 2) === '0' || code.substring(1, 2) === '3';
        }

        // Avoid duplicates
        if (!dtcs.find(d => d.code === code)) {
          dtcs.push({
            code,
            name: description,
            description: description,
            system,
            isGeneric,
            category: null // Will be determined based on description
          });
        }
      }
    }

    // Sort by code
    dtcs.sort((a, b) => a.code.localeCompare(b.code));

    console.log(`Total unique DTCs extracted: ${dtcs.length}`);

    // Group by prefix for summary
    const summary = {};
    for (const dtc of dtcs) {
      const prefix = dtc.code[0];
      summary[prefix] = (summary[prefix] || 0) + 1;
    }

    console.log('Summary by type:', summary);

    // Count generic vs manufacturer specific
    const genericCount = dtcs.filter(d => d.isGeneric).length;
    const manufacturerCount = dtcs.filter(d => !d.isGeneric).length;
    console.log(`Generic codes: ${genericCount}`);
    console.log(`Manufacturer specific codes: ${manufacturerCount}`);

    // Save to file
    fs.writeFileSync('launchtech-dtcs.json', JSON.stringify(dtcs, null, 2));
    console.log('\nDTCs saved to launchtech-dtcs.json');

    // Show some examples
    console.log('\nExample DTCs:');
    dtcs.slice(0, 10).forEach(dtc => {
      console.log(`  ${dtc.code}: ${dtc.name} [${dtc.system}${dtc.isGeneric ? ', Generic' : ''}]`);
    });

    return dtcs;
  } catch (error) {
    console.error('Error extracting DTCs:', error);
    return [];
  }
}

// Run if called directly
if (require.main === module) {
  extractDTCs();
}

module.exports = extractDTCs;