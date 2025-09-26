const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

async function fetchDTCsFromLaunchTech() {
  console.log('Fetching DTCs from Launch Tech website...');

  try {
    const response = await fetch('https://www.launchtech.co.uk/support/information/dtc-codes-list/');
    const html = await response.text();

    console.log('Page fetched, parsing HTML...');
    const $ = cheerio.load(html);

    const dtcs = [];

    // Parse each tab section
    const sections = {
      'P': '#tab-p-codes',
      'B': '#tab-b-codes',
      'C': '#tab-c-codes',
      'U': '#tab-u-codes'
    };

    for (const [prefix, selector] of Object.entries(sections)) {
      console.log(`Extracting ${prefix} codes...`);

      const section = $(selector);
      if (section.length) {
        section.find('tr').each((i, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 2) {
            const code = $(cells[0]).text().trim();
            const description = $(cells[1]).text().trim();

            if (code && code.startsWith(prefix)) {
              let system = 'Unknown';
              let category = null;

              // Determine system based on code prefix
              if (prefix === 'P') {
                system = 'Powertrain';
                // P0xxx and P2xxx are generic
                const codeNum = parseInt(code.substring(1));
                if (codeNum < 1000 || (codeNum >= 2000 && codeNum < 3000)) {
                  category = 'Generic';
                } else {
                  category = 'Manufacturer Specific';
                }
              } else if (prefix === 'B') {
                system = 'Body';
                category = code.substring(1, 2) === '0' ? 'Generic' : 'Manufacturer Specific';
              } else if (prefix === 'C') {
                system = 'Chassis';
                category = code.substring(1, 2) === '0' ? 'Generic' : 'Manufacturer Specific';
              } else if (prefix === 'U') {
                system = 'Network';
                category = code.substring(1, 2) === '0' ? 'Generic' : 'Manufacturer Specific';
              }

              dtcs.push({
                code,
                name: description,
                description: description,
                system,
                isGeneric: category === 'Generic',
                category
              });
            }
          }
        });
      }
    }

    console.log(`Total DTCs extracted: ${dtcs.length}`);

    // Group by prefix for summary
    const summary = {};
    for (const dtc of dtcs) {
      const prefix = dtc.code[0];
      summary[prefix] = (summary[prefix] || 0) + 1;
    }

    console.log('Summary:', summary);

    // Save to file
    fs.writeFileSync('launchtech-dtcs.json', JSON.stringify(dtcs, null, 2));
    console.log('DTCs saved to launchtech-dtcs.json');

    return dtcs;
  } catch (error) {
    console.error('Error fetching DTCs:', error);
    return [];
  }
}

// Run if called directly
if (require.main === module) {
  fetchDTCsFromLaunchTech();
}

module.exports = fetchDTCsFromLaunchTech;