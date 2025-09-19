/**
 * Knowledge Discovery Engine
 * Analyzes trace files to discover and suggest new diagnostic definitions
 */

import { prisma } from '@/lib/prisma';
import { DefinitionType, DiscoveryItemStatus, HierarchyLevel, SourceType, DTCSeverity } from '@prisma/client';

interface TraceMessage {
  timestamp: string;
  source: string;
  target: string;
  service: string;
  data: string;
  response?: string;
}

interface DiscoveryPattern {
  type: DefinitionType;
  identifier: string;
  name?: string;
  confidence: number;
  evidence: any;
  occurrences: number;
}

/**
 * Analyzes trace data to discover ECU definitions
 */
export function discoverECUs(messages: TraceMessage[]): DiscoveryPattern[] {
  const ecuMap = new Map<string, { count: number; roles: Set<string> }>();

  // Common known ECU addresses
  const knownECUs: Record<string, string> = {
    '0E80': 'Tester',
    '1706': 'BCM (Body Control Module)',
    '1707': 'PSCM (Power Steering Control Module)',
    '170C': 'SCCM (Steering Column Control Module)',
    '1710': 'DDM (Driver Door Module)',
    '1711': 'PDM (Passenger Door Module)',
    '1712': 'RLDM (Rear Left Door Module)',
    '1713': 'RRDM (Rear Right Door Module)',
    '1718': 'DSM (Driver Seat Module)',
    '171A': 'PSM (Passenger Seat Module)',
    '1720': 'HVAC (Climate Control)',
    '1730': 'IPC (Instrument Panel Cluster)',
    '1740': 'RCM (Restraint Control Module)',
    '1750': 'GPSM (Global Positioning System Module)',
    '1760': 'ACM (Audio Control Module)',
    '1770': 'APIM (Accessory Protocol Interface Module)',
    '1780': 'IPMA (Image Processing Module A)',
    '1781': 'IPMA-B (Image Processing Module B)',
    '1790': 'TCU (Telematic Control Unit)',
    '17E0': 'GWM (Gateway Module)',
    '07E0': 'PCM/ECM (Engine Control Module)',
    '07E8': 'PCM/ECM Response',
    '07DF': 'Broadcast Request',
  };

  messages.forEach((msg) => {
    // Track source addresses
    if (msg.source && msg.source !== '0E80') {
      if (!ecuMap.has(msg.source)) {
        ecuMap.set(msg.source, { count: 0, roles: new Set() });
      }
      const ecu = ecuMap.get(msg.source)!;
      ecu.count++;

      // Infer role based on services used
      if (msg.service === '10') ecu.roles.add('Diagnostic');
      if (msg.service === '22') ecu.roles.add('DataProvider');
      if (msg.service === '2E') ecu.roles.add('Configurable');
      if (msg.service === '31') ecu.roles.add('RoutineControl');
      if (msg.service === '19') ecu.roles.add('DTCProvider');
    }

    // Track target addresses
    if (msg.target && msg.target !== '0E80') {
      if (!ecuMap.has(msg.target)) {
        ecuMap.set(msg.target, { count: 0, roles: new Set() });
      }
      ecuMap.get(msg.target)!.count++;
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  ecuMap.forEach((info, address) => {
    const knownName = knownECUs[address.toUpperCase()];
    const confidence = knownName ? 0.95 : 0.6 + Math.min(0.3, info.count / 100);

    discoveries.push({
      type: DefinitionType.ECU,
      identifier: address.toUpperCase(),
      name: knownName || `ECU_${address.toUpperCase()}`,
      confidence,
      evidence: {
        messageCount: info.count,
        roles: Array.from(info.roles),
        isKnown: !!knownName,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}

/**
 * Analyzes trace data to discover UDS service definitions
 */
export function discoverServices(messages: TraceMessage[]): DiscoveryPattern[] {
  const serviceMap = new Map<string, { count: number; subfunctions: Set<string> }>();

  // Standard UDS services
  const knownServices: Record<string, string> = {
    '10': 'Diagnostic Session Control',
    '11': 'ECU Reset',
    '14': 'Clear Diagnostic Information',
    '19': 'Read DTC Information',
    '22': 'Read Data By Identifier',
    '23': 'Read Memory By Address',
    '24': 'Read Scaling Data By Identifier',
    '27': 'Security Access',
    '28': 'Communication Control',
    '2A': 'Read Data By Periodic Identifier',
    '2C': 'Dynamically Define Data Identifier',
    '2E': 'Write Data By Identifier',
    '2F': 'Input Output Control By Identifier',
    '31': 'Routine Control',
    '34': 'Request Download',
    '35': 'Request Upload',
    '36': 'Transfer Data',
    '37': 'Request Transfer Exit',
    '38': 'Request File Transfer',
    '3D': 'Write Memory By Address',
    '3E': 'Tester Present',
    '85': 'Control DTC Setting',
    '86': 'Response On Event',
    '87': 'Link Control',
  };

  messages.forEach((msg) => {
    if (msg.service) {
      const serviceId = msg.service.substring(0, 2).toUpperCase();

      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, { count: 0, subfunctions: new Set() });
      }

      const service = serviceMap.get(serviceId)!;
      service.count++;

      // Extract subfunction if present
      if (msg.service.length > 2) {
        const subfunction = msg.service.substring(2, 4);
        service.subfunctions.add(subfunction);
      }
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  serviceMap.forEach((info, serviceId) => {
    const knownName = knownServices[serviceId];
    const confidence = knownName ? 0.98 : 0.5 + Math.min(0.4, info.count / 50);

    discoveries.push({
      type: DefinitionType.SERVICE,
      identifier: serviceId,
      name: knownName || `Service_${serviceId}`,
      confidence,
      evidence: {
        messageCount: info.count,
        subfunctions: Array.from(info.subfunctions),
        isStandard: !!knownName,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}

/**
 * Analyzes trace data to discover DID definitions
 */
export function discoverDIDs(messages: TraceMessage[]): DiscoveryPattern[] {
  const didMap = new Map<string, {
    count: number;
    dataLengths: Set<number>;
    sampleValues: string[];
    ecuAddresses: Set<string>;
  }>();

  // Common DIDs
  const knownDIDs: Record<string, string> = {
    'F190': 'VIN (Vehicle Identification Number)',
    'F187': 'ECU Software Number',
    'F188': 'ECU Software Version',
    'F189': 'ECU Software Date',
    'F18A': 'System Supplier Identifier',
    'F18B': 'ECU Manufacturing Date',
    'F18C': 'System Supplier ECU Software Number',
    'F18E': 'ECU Serial Number',
    'F191': 'Vehicle Manufacturer Hardware Number',
    'F192': 'Vehicle Manufacturer Software Number',
    'F193': 'Vehicle Manufacturer Software Version',
    'F194': 'System Supplier Hardware Number',
    'F195': 'System Supplier Hardware Version',
    'F197': 'System Name',
    'F199': 'Programming Date',
    'F19D': 'ODX File Version',
    'F19E': 'Entity',
  };

  messages.forEach((msg) => {
    // Look for Read Data By Identifier (service 22)
    if (msg.service && msg.service.startsWith('22')) {
      const did = msg.service.substring(2, 6).toUpperCase();

      if (did.length === 4) {
        if (!didMap.has(did)) {
          didMap.set(did, {
            count: 0,
            dataLengths: new Set(),
            sampleValues: [],
            ecuAddresses: new Set(),
          });
        }

        const didInfo = didMap.get(did)!;
        didInfo.count++;
        didInfo.ecuAddresses.add(msg.target);

        // Analyze response data
        if (msg.response) {
          // Assume response format: 62XXXX[DATA]
          if (msg.response.startsWith('62')) {
            const dataStart = 6; // After 62XXXX
            const data = msg.response.substring(dataStart);
            const dataLength = data.length / 2; // Convert hex length to bytes

            didInfo.dataLengths.add(dataLength);

            // Store sample values (limit to 5)
            if (didInfo.sampleValues.length < 5) {
              didInfo.sampleValues.push(data);
            }
          }
        }
      }
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  didMap.forEach((info, did) => {
    const knownName = knownDIDs[did];
    const confidence = knownName ? 0.95 : 0.4 + Math.min(0.5, info.count / 20);

    // Infer data type from sample values
    let inferredType = 'HEX';
    if (info.sampleValues.length > 0) {
      // Check if all samples are ASCII-printable
      const isAscii = info.sampleValues.every(val => {
        for (let i = 0; i < val.length; i += 2) {
          const byte = parseInt(val.substr(i, 2), 16);
          if (byte < 0x20 || byte > 0x7E) return false;
        }
        return true;
      });
      if (isAscii) inferredType = 'ASCII';
    }

    discoveries.push({
      type: DefinitionType.DID,
      identifier: did,
      name: knownName || `DID_${did}`,
      confidence,
      evidence: {
        messageCount: info.count,
        dataLengths: Array.from(info.dataLengths),
        sampleValues: info.sampleValues.slice(0, 3),
        ecuAddresses: Array.from(info.ecuAddresses),
        inferredType,
        isKnown: !!knownName,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}

/**
 * Analyzes trace data to discover DTC definitions
 */
export function discoverDTCs(messages: TraceMessage[]): DiscoveryPattern[] {
  const dtcMap = new Map<string, {
    count: number;
    statusBytes: Set<string>;
    ecuAddresses: Set<string>;
  }>();

  messages.forEach((msg) => {
    // Look for Read DTC Information (service 19)
    if (msg.service && msg.service.startsWith('19') && msg.response) {
      // Parse DTC codes from response
      // Format varies by subfunction, but typically includes DTC codes
      const response = msg.response;

      // Simple pattern matching for DTC codes (P, C, B, U codes)
      const dtcPattern = /[PCBU][0-9A-F]{4}/g;
      const matches = response.match(dtcPattern);

      if (matches) {
        matches.forEach(dtc => {
          if (!dtcMap.has(dtc)) {
            dtcMap.set(dtc, {
              count: 0,
              statusBytes: new Set(),
              ecuAddresses: new Set(),
            });
          }

          const dtcInfo = dtcMap.get(dtc)!;
          dtcInfo.count++;
          dtcInfo.ecuAddresses.add(msg.target);

          // Try to extract status byte (usually follows DTC code)
          const dtcIndex = response.indexOf(dtc);
          if (dtcIndex !== -1 && dtcIndex + 10 < response.length) {
            const statusByte = response.substr(dtcIndex + 10, 2);
            dtcInfo.statusBytes.add(statusByte);
          }
        });
      }
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  dtcMap.forEach((info, dtc) => {
    // Determine severity based on DTC prefix
    let severity = 'MEDIUM';
    if (dtc.startsWith('P0')) severity = 'HIGH'; // Powertrain
    if (dtc.startsWith('B')) severity = 'LOW';    // Body
    if (dtc.startsWith('C')) severity = 'MEDIUM'; // Chassis
    if (dtc.startsWith('U')) severity = 'HIGH';   // Network

    discoveries.push({
      type: DefinitionType.DTC,
      identifier: dtc,
      name: `DTC_${dtc}`,
      confidence: 0.7 + Math.min(0.2, info.count / 10),
      evidence: {
        messageCount: info.count,
        statusBytes: Array.from(info.statusBytes),
        ecuAddresses: Array.from(info.ecuAddresses),
        inferredSeverity: severity,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}

/**
 * Analyzes trace data to discover Routine definitions
 */
export function discoverRoutines(messages: TraceMessage[]): DiscoveryPattern[] {
  const routineMap = new Map<string, {
    count: number;
    controlTypes: Set<string>;
    ecuAddresses: Set<string>;
  }>();

  messages.forEach((msg) => {
    // Look for Routine Control (service 31)
    if (msg.service && msg.service.startsWith('31')) {
      const controlType = msg.service.substring(2, 4);
      const routineId = msg.service.substring(4, 8).toUpperCase();

      if (routineId.length === 4) {
        if (!routineMap.has(routineId)) {
          routineMap.set(routineId, {
            count: 0,
            controlTypes: new Set(),
            ecuAddresses: new Set(),
          });
        }

        const routineInfo = routineMap.get(routineId)!;
        routineInfo.count++;
        routineInfo.controlTypes.add(controlType);
        routineInfo.ecuAddresses.add(msg.target);
      }
    }
  });

  const discoveries: DiscoveryPattern[] = [];

  routineMap.forEach((info, routineId) => {
    // Infer routine capabilities from control types
    const supportsStart = info.controlTypes.has('01');
    const supportsStop = info.controlTypes.has('02');
    const supportsResults = info.controlTypes.has('03');

    discoveries.push({
      type: DefinitionType.ROUTINE,
      identifier: routineId,
      name: `Routine_${routineId}`,
      confidence: 0.6 + Math.min(0.3, info.count / 15),
      evidence: {
        messageCount: info.count,
        controlTypes: Array.from(info.controlTypes),
        ecuAddresses: Array.from(info.ecuAddresses),
        supportsStart,
        supportsStop,
        supportsResults,
      },
      occurrences: info.count,
    });
  });

  return discoveries;
}

/**
 * Main discovery function that analyzes trace data
 */
export async function discoverKnowledge(
  jobId: string,
  messages: TraceMessage[],
  userId: string,
  autoApplyThreshold: number = 0.9
) {
  // Create discovery session
  const session = await prisma.discoverySession.create({
    data: {
      jobId,
      status: 'RUNNING',
      createdBy: userId,
    },
  });

  try {
    // Discover all types of definitions
    const ecuDiscoveries = discoverECUs(messages);
    const serviceDiscoveries = discoverServices(messages);
    const didDiscoveries = discoverDIDs(messages);
    const dtcDiscoveries = discoverDTCs(messages);
    const routineDiscoveries = discoverRoutines(messages);

    // Combine all discoveries
    const allDiscoveries = [
      ...ecuDiscoveries,
      ...serviceDiscoveries,
      ...didDiscoveries,
      ...dtcDiscoveries,
      ...routineDiscoveries,
    ];

    // Sort by confidence
    allDiscoveries.sort((a, b) => b.confidence - a.confidence);

    // Create discovery records
    const discoveryRecords = await Promise.all(
      allDiscoveries.map(async (pattern) => {
        const status = pattern.confidence >= autoApplyThreshold
          ? DiscoveryItemStatus.AUTO_APPLIED
          : DiscoveryItemStatus.PENDING;

        return await prisma.discovery.create({
          data: {
            sessionId: session.id,
            type: pattern.type,
            identifier: pattern.identifier,
            suggestedName: pattern.name,
            confidence: pattern.confidence,
            evidence: pattern.evidence,
            status,
            appliedAt: status === DiscoveryItemStatus.AUTO_APPLIED ? new Date() : null,
          },
        });
      })
    );

    // Auto-apply high-confidence discoveries
    const autoApplied = discoveryRecords.filter(
      d => d.status === DiscoveryItemStatus.AUTO_APPLIED
    );

    if (autoApplied.length > 0) {
      // Get or create discovery source
      let source = await prisma.knowledgeSource.findFirst({
        where: {
          type: SourceType.DISCOVERED,
          name: 'Automatic Discovery',
        },
      });

      if (!source) {
        source = await prisma.knowledgeSource.create({
          data: {
            name: 'Automatic Discovery',
            type: SourceType.DISCOVERED,
            description: 'Automatically discovered from trace files',
            priority: 75,
            isActive: true,
          },
        });
      }

      // Apply discoveries based on type
      for (const discovery of autoApplied) {
        const pattern = allDiscoveries.find(p => p.identifier === discovery.identifier);
        if (!pattern) continue;

        // Get job details for context
        const job = await prisma.diagnosticJob.findUnique({
          where: { id: jobId },
          include: {
            Vehicle: {
              include: {
                ModelYear: {
                  include: {
                    Model: {
                      include: {
                        OEM: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!job) continue;

        const context = {
          jobId: jobId,
          oemId: job.Vehicle.ModelYear.Model.OEM.id,
          modelId: job.Vehicle.ModelYear.Model.id,
          modelYearId: job.Vehicle.ModelYear.id,
        };

        // Apply based on type
        switch (discovery.type) {
          case DefinitionType.ECU:
            await applyECUDiscovery(discovery, pattern, source, context, userId);
            break;
          case DefinitionType.SERVICE:
            await applyServiceDiscovery(discovery, pattern, source, context, userId);
            break;
          case DefinitionType.DID:
            await applyDIDDiscovery(discovery, pattern, source, context, userId);
            break;
          case DefinitionType.DTC:
            await applyDTCDiscovery(discovery, pattern, source, context, userId);
            break;
          case DefinitionType.ROUTINE:
            await applyRoutineDiscovery(discovery, pattern, source, context, userId);
            break;
        }
      }
    }

    // Update session statistics
    await prisma.discoverySession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ecuCount: ecuDiscoveries.length,
        serviceCount: serviceDiscoveries.length,
        didCount: didDiscoveries.length,
        dtcCount: dtcDiscoveries.length,
        routineCount: routineDiscoveries.length,
      },
    });

    return session;
  } catch (error) {
    // Update session status on error
    await prisma.discoverySession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Helper functions to apply discoveries
async function applyECUDiscovery(
  discovery: any,
  pattern: DiscoveryPattern,
  source: any,
  context: any,
  userId: string
) {
  // Check if already exists
  const existing = await prisma.eCUDefinition.findFirst({
    where: {
      address: discovery.identifier,
      modelYearId: context.modelYearId,
    },
  });

  if (!existing) {
    // Get job name from the current job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: context.jobId },
      select: { name: true },
    });

    await prisma.eCUDefinition.create({
      data: {
        address: discovery.identifier,
        name: discovery.suggestedName,
        description: null, // User-editable, starts as null
        // jobName: job?.name || 'Unknown Job', // temporarily disabled
        oemId: context.oemId,
        modelId: context.modelId,
        modelYearId: context.modelYearId,
        sourceId: source.id,
        confidence: discovery.confidence,
        isVerified: false,
        createdBy: userId,
        modifiedBy: userId,
      },
    });
  }
}

async function applyServiceDiscovery(
  discovery: any,
  pattern: DiscoveryPattern,
  source: any,
  context: any,
  userId: string
) {
  const existing = await prisma.serviceDefinition.findFirst({
    where: {
      serviceId: discovery.identifier,
      modelYearId: context.modelYearId,
    },
  });

  if (!existing) {
    // Get job name from the current job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: context.jobId },
      select: { name: true },
    });

    await prisma.serviceDefinition.create({
      data: {
        serviceId: discovery.identifier,
        name: discovery.suggestedName,
        description: null, // User-editable, starts as null
        // jobName: job?.name || 'Unknown Job', // temporarily disabled
        oemId: context.oemId,
        modelId: context.modelId,
        modelYearId: context.modelYearId,
        sourceId: source.id,
        confidence: discovery.confidence,
        isVerified: false,
        createdBy: userId,
        modifiedBy: userId,
      },
    });
  }
}

async function applyDIDDiscovery(
  discovery: any,
  pattern: DiscoveryPattern,
  source: any,
  context: any,
  userId: string
) {
  const existing = await prisma.dIDDefinition.findFirst({
    where: {
      did: discovery.identifier,
      modelYearId: context.modelYearId,
    },
  });

  if (!existing) {
    // Get job name from the current job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: context.jobId },
      select: { name: true },
    });

    await prisma.dIDDefinition.create({
      data: {
        did: discovery.identifier,
        name: discovery.suggestedName,
        description: null, // User-editable, starts as null
        // jobName: job?.name || 'Unknown Job', // temporarily disabled
        dataType: pattern.evidence.inferredType || 'HEX',
        oemId: context.oemId,
        modelId: context.modelId,
        modelYearId: context.modelYearId,
        sourceId: source.id,
        confidence: discovery.confidence,
        isVerified: false,
        createdBy: userId,
        modifiedBy: userId,
      },
    });
  }
}

async function applyDTCDiscovery(
  discovery: any,
  pattern: DiscoveryPattern,
  source: any,
  context: any,
  userId: string
) {
  const existing = await prisma.dTCDefinition.findFirst({
    where: {
      code: discovery.identifier,
      modelYearId: context.modelYearId,
    },
  });

  if (!existing) {
    // Get job name from the current job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: context.jobId },
      select: { name: true },
    });

    await prisma.dTCDefinition.create({
      data: {
        code: discovery.identifier,
        name: discovery.suggestedName,
        description: null, // User-editable, starts as null
        // jobName: job?.name || 'Unknown Job', // temporarily disabled
        severity: pattern.evidence.inferredSeverity || 'MEDIUM',
        oemId: context.oemId,
        modelId: context.modelId,
        modelYearId: context.modelYearId,
        sourceId: source.id,
        confidence: discovery.confidence,
        isVerified: false,
        createdBy: userId,
        modifiedBy: userId,
      },
    });
  }
}

async function applyRoutineDiscovery(
  discovery: any,
  pattern: DiscoveryPattern,
  source: any,
  context: any,
  userId: string
) {
  const existing = await prisma.routineDefinition.findFirst({
    where: {
      routineId: discovery.identifier,
      modelYearId: context.modelYearId,
    },
  });

  if (!existing) {
    // Get job name from the current job
    const job = await prisma.diagnosticJob.findUnique({
      where: { id: context.jobId },
      select: { name: true },
    });

    await prisma.routineDefinition.create({
      data: {
        routineId: discovery.identifier,
        name: discovery.suggestedName,
        description: null, // User-editable, starts as null
        // jobName: job?.name || 'Unknown Job', // temporarily disabled
        supportsStart: pattern.evidence.supportsStart || false,
        supportsStop: pattern.evidence.supportsStop || false,
        supportsResults: pattern.evidence.supportsResults || false,
        oemId: context.oemId,
        modelId: context.modelId,
        modelYearId: context.modelYearId,
        sourceId: source.id,
        confidence: discovery.confidence,
        isVerified: false,
        createdBy: userId,
        modifiedBy: userId,
      },
    });
  }
}

/**
 * Simplified wrapper function for job-based knowledge discovery
 * Automatically fetches job data and processes it
 */
export async function discoverKnowledgeFromJob(jobId: string) {
  // Get job with all parsed data
  const job = await prisma.diagnosticJob.findUnique({
    where: { id: jobId },
    include: {
      Vehicle: {
        include: {
          ModelYear: {
            include: {
              Model: {
                include: {
                  OEM: true
                }
              }
            }
          }
        }
      },
      User: true,
      ECUConfiguration: true,
      DataIdentifier: true,
      DTC: true,
      Routine: true
    }
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  if (!job.User) {
    throw new Error(`Job ${jobId} has no associated user`);
  }

  console.log(`Starting knowledge discovery for job ${jobId}`);
  console.log(`Found ${job.ECUConfiguration.length} ECUs, ${job.DataIdentifier.length} DIDs, ${job.DTC.length} DTCs, ${job.Routine.length} routines`);

  try {
    // Use a transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
    // Create or find a KnowledgeSource for this discovery
    const sourceName = `Job Discovery: ${job.name}`;
    let knowledgeSource = await tx.knowledgeSource.findFirst({
      where: { name: sourceName }
    });

    if (!knowledgeSource) {
      knowledgeSource = await tx.knowledgeSource.create({
        data: {
          name: sourceName,
          type: SourceType.DISCOVERED,
          description: `Knowledge discovered from diagnostic job: ${job.name}`,
          priority: 1
        }
      });
      console.log(`Created knowledge source: ${knowledgeSource.id}`);
    }

    let ecuCount = 0, didCount = 0, dtcCount = 0, routineCount = 0;

    // Process ECUs
    for (const ecu of job.ECUConfiguration) {
      const existing = await tx.eCUDefinition.findFirst({
      where: {
        address: ecu.targetAddress,
        modelYearId: job.Vehicle.ModelYear.id,
      },
    });

    if (!existing) {
        await tx.eCUDefinition.create({
        data: {
          address: ecu.targetAddress,
          name: ecu.ecuName,
          description: null,  // User-editable field, starts empty
          // jobName: job.name,  // Store the job name that discovered this (temporarily disabled)
          oemId: job.Vehicle.ModelYear.Model.OEM.id,
          modelId: job.Vehicle.ModelYear.Model.id,
          modelYearId: job.Vehicle.ModelYear.id,
          sourceId: knowledgeSource.id,
          confidence: 0.85,
          isVerified: false,
          createdBy: job.User.id,
          modifiedBy: job.User.id,
        },
      });
        ecuCount++;
        console.log(`Added ECU definition: ${ecu.ecuName} (${ecu.targetAddress})`);
      }
    }

    // Process DIDs
    for (const did of job.DataIdentifier) {
      const existing = await tx.dIDDefinition.findFirst({
      where: {
        did: did.did,
        modelYearId: job.Vehicle.ModelYear.id,
      },
    });

      if (!existing) {
        await tx.dIDDefinition.create({
        data: {
          did: did.did,
          name: did.name,
          description: null,  // User-editable field, starts empty
          // jobName: job.name,  // Store the job name that discovered this (temporarily disabled)
          dataType: did.dataType || 'BINARY',
          unit: null,
          oemId: job.Vehicle.ModelYear.Model.OEM.id,
          modelId: job.Vehicle.ModelYear.Model.id,
          modelYearId: job.Vehicle.ModelYear.id,
          sourceId: knowledgeSource.id,
          confidence: 0.80,
          isVerified: false,
          createdBy: job.User.id,
          modifiedBy: job.User.id,
        },
      });
        didCount++;
        console.log(`Added DID definition: ${did.name} (${did.did})`);
      }
    }

    // Process DTCs
    for (const dtc of job.DTC) {
      const existing = await tx.dTCDefinition.findFirst({
      where: {
        code: dtc.code,
        modelYearId: job.Vehicle.ModelYear.id,
      },
    });

      if (!existing) {
        await tx.dTCDefinition.create({
        data: {
          code: dtc.code,
          name: dtc.description || `DTC ${dtc.code}`,
          description: null,  // User-editable field, starts empty
          // jobName: job.name,  // Store the job name that discovered this (temporarily disabled)
          severity: DTCSeverity.MEDIUM,
          oemId: job.Vehicle.ModelYear.Model.OEM.id,
          modelId: job.Vehicle.ModelYear.Model.id,
          modelYearId: job.Vehicle.ModelYear.id,
          sourceId: knowledgeSource.id,
          confidence: 0.80,
          isVerified: false,
          createdBy: job.User.id,
          modifiedBy: job.User.id,
        },
      });
        dtcCount++;
        console.log(`Added DTC definition: ${dtc.code}`);
      }
    }

    // Process Routines
    for (const routine of job.Routine) {
      const existing = await tx.routineDefinition.findFirst({
      where: {
        routineId: routine.routineId,
        modelYearId: job.Vehicle.ModelYear.id,
      },
    });

      if (!existing) {
        await tx.routineDefinition.create({
        data: {
          routineId: routine.routineId,
          name: routine.name,
          description: null,  // User-editable field, starts empty
          // jobName: job.name,  // Store the job name that discovered this (temporarily disabled)
          supportsStart: true,
          supportsStop: false,
          supportsResults: routine.hasOutput || false,
          oemId: job.Vehicle.ModelYear.Model.OEM.id,
          modelId: job.Vehicle.ModelYear.Model.id,
          modelYearId: job.Vehicle.ModelYear.id,
          sourceId: knowledgeSource.id,
          confidence: 0.80,
          isVerified: false,
          createdBy: job.User.id,
          modifiedBy: job.User.id,
        },
      });
        routineCount++;
        console.log(`Added Routine definition: ${routine.name} (${routine.routineId})`);
      }
    }

    // Create discovery session with actual counts
    const session = await tx.discoverySession.create({
    data: {
      jobId,
      status: 'COMPLETED',
      createdBy: job.User.id,
      completedAt: new Date(),
      ecuCount,
      serviceCount: 0,
      didCount,
      dtcCount,
      routineCount,
    },
  });

    console.log(`Knowledge discovery completed for job ${jobId}: ${ecuCount} ECUs, ${didCount} DIDs, ${dtcCount} DTCs, ${routineCount} routines added to knowledge base`);
    return { session, ecuCount, didCount, dtcCount, routineCount };
    }, {
      maxWait: 10000, // Wait max 10 seconds
      timeout: 30000, // Transaction timeout of 30 seconds
    });

    return result.session;
  } catch (error) {
    console.error(`Error in knowledge discovery for job ${jobId}:`, error);
    throw error;
  }
}
