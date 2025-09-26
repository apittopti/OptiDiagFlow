const fs = require('fs');
const cheerio = require('cheerio');

function parseLaunchTechHTML() {
  console.log('Parsing Launch Tech HTML file...');

  try {
    const html = fs.readFileSync('launchtech-page.html', 'utf8');
    const $ = cheerio.load(html);

    const dtcs = [];

    // Parse each accordion section
    $('.accordion-item').each((index, item) => {
      const $item = $(item);
      const title = $item.find('.accordion-button').text().trim();

      console.log(`Processing section: ${title}`);

      // Get the content panel
      const content = $item.find('.accordion-body');

      // Find all table rows
      content.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const code = $(cells[0]).text().trim();
          const description = $(cells[1]).text().trim();

          if (code && description && /^[PBCU]\d{4}/.test(code)) {
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
              isGeneric = code.substring(1, 2) === '0';
            }

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
      });

      // Also check for codes in paragraph text
      content.find('p').each((i, p) => {
        const text = $(p).text();
        // Match pattern like "P0010 - Description"
        const matches = text.matchAll(/([PBCU]\d{4})\s*[-–]\s*([^,\n]+)/g);
        for (const match of matches) {
          const code = match[1];
          const description = match[2].trim();

          // Check if we already have this code
          if (!dtcs.find(d => d.code === code)) {
            const prefix = code[0];
            let system = 'Unknown';
            let isGeneric = false;

            if (prefix === 'P') {
              system = 'Powertrain';
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
              isGeneric = code.substring(1, 2) === '0';
            }

            dtcs.push({
              code,
              name: description,
              description: description,
              system,
              isGeneric,
              category: null
            });
          }
        }
      });
    });

    // Remove duplicates
    const uniqueDTCs = [];
    const seen = new Set();
    for (const dtc of dtcs) {
      if (!seen.has(dtc.code)) {
        seen.add(dtc.code);
        uniqueDTCs.push(dtc);
      }
    }

    // Sort by code
    uniqueDTCs.sort((a, b) => a.code.localeCompare(b.code));

    console.log(`Total unique DTCs extracted: ${uniqueDTCs.length}`);

    // Group by prefix for summary
    const summary = {};
    for (const dtc of uniqueDTCs) {
      const prefix = dtc.code[0];
      summary[prefix] = (summary[prefix] || 0) + 1;
    }

    console.log('Summary by type:', summary);

    // Save to file
    fs.writeFileSync('launchtech-dtcs.json', JSON.stringify(uniqueDTCs, null, 2));
    console.log('DTCs saved to launchtech-dtcs.json');

    // Show some examples
    console.log('\nExample DTCs:');
    uniqueDTCs.slice(0, 5).forEach(dtc => {
      console.log(`  ${dtc.code}: ${dtc.name}`);
    });

    return uniqueDTCs;
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return [];
  }
}

// Run if called directly
if (require.main === module) {
  parseLaunchTechHTML();
}

module.exports = parseLaunchTechHTML;