import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { HierarchyLevel, SourceType } from '@prisma/client';

// GET - List ECU definitions with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const level = searchParams.get('level') as HierarchyLevel | null;
    const oemId = searchParams.get('oemId');
    const modelId = searchParams.get('modelId');
    const modelYearId = searchParams.get('modelYearId');
    const vehicleId = searchParams.get('vehicleId');
    const address = searchParams.get('address');
    const verified = searchParams.get('verified');

    const where: any = {};

    if (level) where.level = level;
    if (oemId) where.oemId = oemId;
    if (modelId) where.modelId = modelId;
    if (modelYearId) where.modelYearId = modelYearId;
    if (vehicleId) where.vehicleId = vehicleId;
    if (address) where.address = { contains: address, mode: 'insensitive' };
    if (verified !== null) where.isVerified = verified === 'true';

    const definitions = await prisma.eCUDefinition.findMany({
      where,
      include: {
        source: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
        _count: {
          select: { auditLogs: true },
        },
      },
      orderBy: [
        { level: 'asc' },
        { address: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error('Error fetching ECU definitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ECU definitions' },
      { status: 500 }
    );
  }
}

// POST - Create new ECU definition
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      address,
      name,
      description,
      category,
      level,
      globalScope,
      oemId,
      modelId,
      modelYearId,
      vehicleId,
      confidence,
      isVerified,
    } = body;

    // Validate required fields
    if (!address || !name || !level) {
      return NextResponse.json(
        { error: 'Address, name, and level are required' },
        { status: 400 }
      );
    }

    // Validate hierarchy consistency
    if (level === HierarchyLevel.VEHICLE && !vehicleId) {
      return NextResponse.json(
        { error: 'Vehicle ID required for vehicle-level definitions' },
        { status: 400 }
      );
    }
    if (level === HierarchyLevel.MODEL_YEAR && !modelYearId) {
      return NextResponse.json(
        { error: 'Model Year ID required for model-year-level definitions' },
        { status: 400 }
      );
    }
    if (level === HierarchyLevel.MODEL && !modelId) {
      return NextResponse.json(
        { error: 'Model ID required for model-level definitions' },
        { status: 400 }
      );
    }
    if (level === HierarchyLevel.OEM && !oemId) {
      return NextResponse.json(
        { error: 'OEM ID required for OEM-level definitions' },
        { status: 400 }
      );
    }

    // Check for existing definition at the same level
    const existing = await prisma.eCUDefinition.findFirst({
      where: {
        address,
        level,
        oemId: oemId || null,
        modelId: modelId || null,
        modelYearId: modelYearId || null,
        vehicleId: vehicleId || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'ECU definition already exists at this level' },
        { status: 409 }
      );
    }

    // Create or get knowledge source
    let source = await prisma.knowledgeSource.findFirst({
      where: {
        type: SourceType.MANUAL,
        name: 'Manual Entry',
      },
    });

    if (!source) {
      source = await prisma.knowledgeSource.create({
        data: {
          name: 'Manual Entry',
          type: SourceType.MANUAL,
          description: 'Manually entered definitions',
          priority: 100,
          isActive: true,
        },
      });
    }

    // Create the ECU definition
    const definition = await prisma.eCUDefinition.create({
      data: {
        address,
        name,
        description,
        category,
        level,
        globalScope: globalScope || false,
        oemId: oemId || null,
        modelId: modelId || null,
        modelYearId: modelYearId || null,
        vehicleId: vehicleId || null,
        sourceId: source.id,
        confidence: confidence || 1.0,
        isVerified: isVerified || false,
        version: 1,
        createdBy: session.user.email,
        modifiedBy: session.user.email,
        auditLogs: {
          create: {
            action: 'CREATE',
            newValue: body,
            changedBy: session.user.email,
            reason: 'Manual creation via API',
          },
        },
      },
      include: {
        source: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
      },
    });

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    console.error('Error creating ECU definition:', error);
    return NextResponse.json(
      { error: 'Failed to create ECU definition' },
      { status: 500 }
    );
  }
}

// PUT - Bulk update/import ECU definitions
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { definitions, sourceType = SourceType.IMPORTED, sourceName } = body;

    if (!definitions || !Array.isArray(definitions)) {
      return NextResponse.json(
        { error: 'Definitions array required' },
        { status: 400 }
      );
    }

    // Create or get knowledge source
    let source = await prisma.knowledgeSource.findFirst({
      where: {
        type: sourceType,
        name: sourceName || 'Bulk Import',
      },
    });

    if (!source) {
      source = await prisma.knowledgeSource.create({
        data: {
          name: sourceName || 'Bulk Import',
          type: sourceType,
          description: 'Bulk imported definitions',
          priority: 50,
          isActive: true,
        },
      });
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as any[],
    };

    // Process each definition
    for (const def of definitions) {
      try {
        const existing = await prisma.eCUDefinition.findFirst({
          where: {
            address: def.address,
            level: def.level,
            oemId: def.oemId || null,
            modelId: def.modelId || null,
            modelYearId: def.modelYearId || null,
            vehicleId: def.vehicleId || null,
          },
        });

        if (existing) {
          // Update existing definition
          await prisma.eCUDefinition.update({
            where: { id: existing.id },
            data: {
              name: def.name,
              description: def.description,
              category: def.category,
              confidence: def.confidence || existing.confidence,
              isVerified: def.isVerified || existing.isVerified,
              version: existing.version + 1,
              modifiedBy: session.user.email,
              auditLogs: {
                create: {
                  action: 'UPDATE',
                  previousValue: existing,
                  newValue: def,
                  changedBy: session.user.email,
                  reason: 'Bulk update via API',
                },
              },
            },
          });
          results.updated++;
        } else {
          // Create new definition
          await prisma.eCUDefinition.create({
            data: {
              address: def.address,
              name: def.name,
              description: def.description,
              category: def.category,
              level: def.level,
              globalScope: def.globalScope || false,
              oemId: def.oemId || null,
              modelId: def.modelId || null,
              modelYearId: def.modelYearId || null,
              vehicleId: def.vehicleId || null,
              sourceId: source.id,
              confidence: def.confidence || 0.8,
              isVerified: def.isVerified || false,
              version: 1,
              createdBy: session.user.email,
              modifiedBy: session.user.email,
              auditLogs: {
                create: {
                  action: 'CREATE',
                  newValue: def,
                  changedBy: session.user.email,
                  reason: 'Bulk import via API',
                },
              },
            },
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          definition: def,
          error: error.message,
        });
        results.skipped++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error bulk updating ECU definitions:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update ECU definitions' },
      { status: 500 }
    );
  }
}