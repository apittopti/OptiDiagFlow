/**
 * Knowledge Base Resolver
 * Handles hierarchical inheritance resolution for diagnostic definitions
 */

import { prisma } from '@/lib/prisma';
import { HierarchyLevel } from '@prisma/client';

export interface ResolverContext {
  oemId?: string;
  modelId?: string;
  modelYearId?: string;
  vehicleId?: string;
  ecuAddress?: string;
}

/**
 * Resolves the most specific ECU definition for a given context
 */
export async function resolveECUDefinition(
  address: string,
  context: ResolverContext
): Promise<any> {
  // Build hierarchy from most specific to least specific
  const conditions = [
    // Vehicle level (most specific)
    context.vehicleId && {
      address,
      level: HierarchyLevel.VEHICLE,
      vehicleId: context.vehicleId,
    },
    // Model Year level
    context.modelYearId && {
      address,
      level: HierarchyLevel.MODEL_YEAR,
      modelYearId: context.modelYearId,
    },
    // Model level
    context.modelId && {
      address,
      level: HierarchyLevel.MODEL,
      modelId: context.modelId,
    },
    // OEM level
    context.oemId && {
      address,
      level: HierarchyLevel.OEM,
      oemId: context.oemId,
    },
    // Global level (least specific)
    {
      address,
      level: HierarchyLevel.GLOBAL,
      globalScope: true,
    },
  ].filter(Boolean);

  // Try each level from most specific to least specific
  for (const condition of conditions) {
    const definition = await prisma.eCUDefinition.findFirst({
      where: condition as any,
      include: {
        source: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
      orderBy: [
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { version: 'desc' },
      ],
    });

    if (definition) {
      return definition;
    }
  }

  return null;
}

/**
 * Resolves the most specific Service definition for a given context
 */
export async function resolveServiceDefinition(
  serviceId: string,
  context: ResolverContext
): Promise<any> {
  const conditions = [
    context.vehicleId && {
      serviceId,
      level: HierarchyLevel.VEHICLE,
      vehicleId: context.vehicleId,
    },
    context.modelYearId && {
      serviceId,
      level: HierarchyLevel.MODEL_YEAR,
      modelYearId: context.modelYearId,
    },
    context.modelId && {
      serviceId,
      level: HierarchyLevel.MODEL,
      modelId: context.modelId,
    },
    context.oemId && {
      serviceId,
      level: HierarchyLevel.OEM,
      oemId: context.oemId,
    },
    {
      serviceId,
      level: HierarchyLevel.GLOBAL,
      globalScope: true,
    },
  ].filter(Boolean);

  for (const condition of conditions) {
    const definition = await prisma.serviceDefinition.findFirst({
      where: condition as any,
      include: {
        source: true,
        subfunctions: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
      orderBy: [
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { version: 'desc' },
      ],
    });

    if (definition) {
      return definition;
    }
  }

  return null;
}

/**
 * Resolves the most specific DID definition for a given context
 */
export async function resolveDIDDefinition(
  did: string,
  context: ResolverContext
): Promise<any> {
  // Build conditions considering ECU address if provided
  const buildCondition = (base: any) => {
    if (context.ecuAddress) {
      return {
        OR: [
          { ...base, ecuAddress: context.ecuAddress },
          { ...base, ecuAddress: null },
        ],
      };
    }
    return base;
  };

  const conditions = [
    context.vehicleId &&
      buildCondition({
        did,
        level: HierarchyLevel.VEHICLE,
        vehicleId: context.vehicleId,
      }),
    context.modelYearId &&
      buildCondition({
        did,
        level: HierarchyLevel.MODEL_YEAR,
        modelYearId: context.modelYearId,
      }),
    context.modelId &&
      buildCondition({
        did,
        level: HierarchyLevel.MODEL,
        modelId: context.modelId,
      }),
    context.oemId &&
      buildCondition({
        did,
        level: HierarchyLevel.OEM,
        oemId: context.oemId,
      }),
    buildCondition({
      did,
      level: HierarchyLevel.GLOBAL,
      globalScope: true,
    }),
  ].filter(Boolean);

  for (const condition of conditions) {
    const definition = await prisma.dIDDefinition.findFirst({
      where: condition as any,
      include: {
        source: true,
        bitFields: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
      orderBy: [
        { ecuAddress: 'desc' }, // Prefer ECU-specific definitions
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { version: 'desc' },
      ],
    });

    if (definition) {
      return definition;
    }
  }

  return null;
}

/**
 * Resolves the most specific DTC definition for a given context
 */
export async function resolveDTCDefinition(
  code: string,
  context: ResolverContext
): Promise<any> {
  const buildCondition = (base: any) => {
    if (context.ecuAddress) {
      return {
        OR: [
          { ...base, ecuAddress: context.ecuAddress },
          { ...base, ecuAddress: null },
        ],
      };
    }
    return base;
  };

  const conditions = [
    context.vehicleId &&
      buildCondition({
        code,
        level: HierarchyLevel.VEHICLE,
        vehicleId: context.vehicleId,
      }),
    context.modelYearId &&
      buildCondition({
        code,
        level: HierarchyLevel.MODEL_YEAR,
        modelYearId: context.modelYearId,
      }),
    context.modelId &&
      buildCondition({
        code,
        level: HierarchyLevel.MODEL,
        modelId: context.modelId,
      }),
    context.oemId &&
      buildCondition({
        code,
        level: HierarchyLevel.OEM,
        oemId: context.oemId,
      }),
    buildCondition({
      code,
      level: HierarchyLevel.GLOBAL,
      globalScope: true,
    }),
  ].filter(Boolean);

  for (const condition of conditions) {
    const definition = await prisma.dTCDefinition.findFirst({
      where: condition as any,
      include: {
        source: true,
        statusBits: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
      orderBy: [
        { ecuAddress: 'desc' },
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { version: 'desc' },
      ],
    });

    if (definition) {
      return definition;
    }
  }

  return null;
}

/**
 * Resolves the most specific Routine definition for a given context
 */
export async function resolveRoutineDefinition(
  routineId: string,
  context: ResolverContext
): Promise<any> {
  const buildCondition = (base: any) => {
    if (context.ecuAddress) {
      return {
        OR: [
          { ...base, ecuAddress: context.ecuAddress },
          { ...base, ecuAddress: null },
        ],
      };
    }
    return base;
  };

  const conditions = [
    context.vehicleId &&
      buildCondition({
        routineId,
        level: HierarchyLevel.VEHICLE,
        vehicleId: context.vehicleId,
      }),
    context.modelYearId &&
      buildCondition({
        routineId,
        level: HierarchyLevel.MODEL_YEAR,
        modelYearId: context.modelYearId,
      }),
    context.modelId &&
      buildCondition({
        routineId,
        level: HierarchyLevel.MODEL,
        modelId: context.modelId,
      }),
    context.oemId &&
      buildCondition({
        routineId,
        level: HierarchyLevel.OEM,
        oemId: context.oemId,
      }),
    buildCondition({
      routineId,
      level: HierarchyLevel.GLOBAL,
      globalScope: true,
    }),
  ].filter(Boolean);

  for (const condition of conditions) {
    const definition = await prisma.routineDefinition.findFirst({
      where: condition as any,
      include: {
        source: true,
        parameters: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
      orderBy: [
        { ecuAddress: 'desc' },
        { isVerified: 'desc' },
        { confidence: 'desc' },
        { version: 'desc' },
      ],
    });

    if (definition) {
      return definition;
    }
  }

  return null;
}

/**
 * Gets all definitions at a specific hierarchy level
 */
export async function getDefinitionsByLevel(
  level: HierarchyLevel,
  context: ResolverContext,
  type: 'ECU' | 'SERVICE' | 'DID' | 'DTC' | 'ROUTINE'
) {
  const baseCondition: any = { level };

  // Add context-specific conditions based on level
  switch (level) {
    case HierarchyLevel.VEHICLE:
      if (context.vehicleId) baseCondition.vehicleId = context.vehicleId;
      break;
    case HierarchyLevel.MODEL_YEAR:
      if (context.modelYearId) baseCondition.modelYearId = context.modelYearId;
      break;
    case HierarchyLevel.MODEL:
      if (context.modelId) baseCondition.modelId = context.modelId;
      break;
    case HierarchyLevel.OEM:
      if (context.oemId) baseCondition.oemId = context.oemId;
      break;
    case HierarchyLevel.GLOBAL:
      baseCondition.globalScope = true;
      break;
  }

  const includeRelations = {
    source: true,
    oem: true,
    model: true,
    modelYear: true,
    vehicle: true,
  };

  switch (type) {
    case 'ECU':
      return await prisma.eCUDefinition.findMany({
        where: baseCondition,
        include: includeRelations,
        orderBy: [{ address: 'asc' }, { name: 'asc' }],
      });

    case 'SERVICE':
      return await prisma.serviceDefinition.findMany({
        where: baseCondition,
        include: { ...includeRelations, subfunctions: true },
        orderBy: [{ serviceId: 'asc' }, { name: 'asc' }],
      });

    case 'DID':
      return await prisma.dIDDefinition.findMany({
        where: baseCondition,
        include: { ...includeRelations, bitFields: true },
        orderBy: [{ did: 'asc' }, { name: 'asc' }],
      });

    case 'DTC':
      return await prisma.dTCDefinition.findMany({
        where: baseCondition,
        include: { ...includeRelations, statusBits: true },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
      });

    case 'ROUTINE':
      return await prisma.routineDefinition.findMany({
        where: baseCondition,
        include: { ...includeRelations, parameters: true },
        orderBy: [{ routineId: 'asc' }, { name: 'asc' }],
      });

    default:
      throw new Error(`Unknown definition type: ${type}`);
  }
}

/**
 * Gets the inheritance chain for a specific definition
 */
export async function getInheritanceChain(
  identifier: string,
  context: ResolverContext,
  type: 'ECU' | 'SERVICE' | 'DID' | 'DTC' | 'ROUTINE'
) {
  const chain = [];

  // Get definitions at each level
  const levels = [
    HierarchyLevel.VEHICLE,
    HierarchyLevel.MODEL_YEAR,
    HierarchyLevel.MODEL,
    HierarchyLevel.OEM,
    HierarchyLevel.GLOBAL,
  ];

  for (const level of levels) {
    let definition = null;

    switch (type) {
      case 'ECU':
        definition = await prisma.eCUDefinition.findFirst({
          where: {
            address: identifier,
            level,
            ...(level === HierarchyLevel.VEHICLE && context.vehicleId
              ? { vehicleId: context.vehicleId }
              : {}),
            ...(level === HierarchyLevel.MODEL_YEAR && context.modelYearId
              ? { modelYearId: context.modelYearId }
              : {}),
            ...(level === HierarchyLevel.MODEL && context.modelId
              ? { modelId: context.modelId }
              : {}),
            ...(level === HierarchyLevel.OEM && context.oemId
              ? { oemId: context.oemId }
              : {}),
            ...(level === HierarchyLevel.GLOBAL ? { globalScope: true } : {}),
          },
          include: {
            source: true,
            oem: true,
            model: true,
            modelYear: true,
            vehicle: true,
          },
        });
        break;

      case 'SERVICE':
        definition = await prisma.serviceDefinition.findFirst({
          where: {
            serviceId: identifier,
            level,
            ...(level === HierarchyLevel.VEHICLE && context.vehicleId
              ? { vehicleId: context.vehicleId }
              : {}),
            ...(level === HierarchyLevel.MODEL_YEAR && context.modelYearId
              ? { modelYearId: context.modelYearId }
              : {}),
            ...(level === HierarchyLevel.MODEL && context.modelId
              ? { modelId: context.modelId }
              : {}),
            ...(level === HierarchyLevel.OEM && context.oemId
              ? { oemId: context.oemId }
              : {}),
            ...(level === HierarchyLevel.GLOBAL ? { globalScope: true } : {}),
          },
          include: {
            source: true,
            subfunctions: true,
            oem: true,
            model: true,
            modelYear: true,
            vehicle: true,
          },
        });
        break;

      // Similar cases for DID, DTC, and ROUTINE...
    }

    if (definition) {
      chain.push({
        level,
        definition,
        isActive: chain.length === 0, // First found is the active one
      });
    }
  }

  return chain;
}

/**
 * Knowledge Resolver Class
 * Main class that aggregates all resolution functions
 */
export class KnowledgeResolver {
  static async resolveECU(address: string, context: ResolverContext) {
    return await resolveECUDefinition(address, context);
  }

  static async resolveService(serviceId: string, context: ResolverContext) {
    return await resolveServiceDefinition(serviceId, context);
  }

  static async resolveDID(did: string, context: ResolverContext) {
    return await resolveDIDDefinition(did, context);
  }

  static async resolveDTC(code: string, context: ResolverContext) {
    return await resolveDTCDefinition(code, context);
  }

  static async resolveRoutine(routineId: string, context: ResolverContext) {
    return await resolveRoutineDefinition(routineId, context);
  }

  static async getDefinitionsByLevel(
    level: HierarchyLevel,
    context: ResolverContext,
    type: 'ECU' | 'SERVICE' | 'DID' | 'DTC' | 'ROUTINE'
  ) {
    return await getDefinitionsByLevel(level, context, type);
  }

  static async getInheritanceChain(
    identifier: string,
    context: ResolverContext,
    type: 'ECU' | 'SERVICE' | 'DID' | 'DTC' | 'ROUTINE'
  ) {
    return await getInheritanceChain(identifier, context, type);
  }
}

// Default export for compatibility
export default KnowledgeResolver;