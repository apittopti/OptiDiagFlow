const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const EXAMPLES_DIR = 'C:\\Optimotive-dev\\OptiDiagFlow\\ExamplesForClaude';

async function fixJobProcedures() {
  console.log('===========================================');
  console.log('   Fixing Job Procedure Types');
  console.log('===========================================');

  try {
    // Get all jobs
    const jobs = await prisma.diagnosticJob.findMany({
      select: {
        id: true,
        name: true,
        procedureType: true,
        metadata: true
      }
    });

    console.log(`\nFound ${jobs.length} jobs to check`);

    let updated = 0;
    for (const job of jobs) {
      // Skip if already has a proper procedure type (not "Diagnostic Session")
      if (job.procedureType && job.procedureType !== 'Diagnostic Session') {
        console.log(`  ✓ Job ${job.name} already has procedure: ${job.procedureType}`);
        continue;
      }

      // Try to find the source trace file
      const traceFiles = job.metadata?.traceFiles || [];
      if (traceFiles.length === 0) {
        console.log(`  ⚠ Job ${job.name} has no trace files`);
        continue;
      }

      const traceFile = traceFiles[0];
      const fileName = traceFile.name || traceFile.fileName || job.name + '.txt';

      // Search for the file in ExamplesForClaude
      const findFile = (dir, targetName) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            const result = findFile(filePath, targetName);
            if (result) return result;
          } else if (file === targetName || file.includes(targetName.replace('.txt', ''))) {
            return filePath;
          }
        }
        return null;
      };

      const sourcePath = findFile(EXAMPLES_DIR, fileName);
      if (!sourcePath) {
        console.log(`  ⚠ Could not find source file for job ${job.name}`);
        continue;
      }

      // Extract procedure type from path
      const relativePath = path.relative(EXAMPLES_DIR, sourcePath);
      const pathParts = relativePath.split(path.sep);

      // Find TraceLogs directory
      let startIndex = -1;
      for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i].toLowerCase().includes('tracelogs')) {
          startIndex = i + 1;
          break;
        }
      }

      if (startIndex === -1 || startIndex >= pathParts.length - 1) {
        console.log(`  ⚠ Invalid path structure for job ${job.name}`);
        continue;
      }

      const relevantParts = pathParts.slice(startIndex);
      let procedureType = null;

      // Find year and get the folder after it
      for (let i = 2; i < relevantParts.length; i++) {
        const part = relevantParts[i];
        const potentialYear = parseInt(part);
        if (!isNaN(potentialYear) && potentialYear >= 1990 && potentialYear <= 2050) {
          // Get the folder after year (procedure type)
          if (i + 1 < relevantParts.length - 1) {
            procedureType = relevantParts[i + 1];
          }
          break;
        }
      }

      if (!procedureType) {
        // If no year/procedure folder structure, default to General Diagnostic
        procedureType = 'General Diagnostic';
      }

      // Update the job
      console.log(`  Updating job ${job.name}: "${job.procedureType}" → "${procedureType}"`);
      await prisma.diagnosticJob.update({
        where: { id: job.id },
        data: { procedureType: procedureType }
      });
      updated++;
    }

    console.log('\n===========================================');
    console.log(`   Update Complete!`);
    console.log(`   Updated ${updated} jobs`);
    console.log('===========================================');

  } catch (error) {
    console.error('Error fixing job procedures:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixJobProcedures();
}

module.exports = { fixJobProcedures };