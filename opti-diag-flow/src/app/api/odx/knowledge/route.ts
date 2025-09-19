import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/odx/knowledge - Get all knowledge base entries with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const isVerified = searchParams.get('isVerified');
    const search = searchParams.get('search');
    const tags = searchParams.getAll('tags');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};

    if (entityType) {
      where.entityType = entityType;

    if (isVerified !== null) {
      where.isVerified = isVerified === 'true';

    if (search) {
      where.OR = [
        { userDescription: { contains: search, mode: 'insensitive' } },
        { technicalNotes: { contains: search, mode: 'insensitive' } },
        { symptoms: { contains: search, mode: 'insensitive' } },
        { solutions: { contains: search, mode: 'insensitive' } },
        { preconditions: { contains: search, mode: 'insensitive' } },
        { expectedResults: { contains: search, mode: 'insensitive' } },
      ];

    // Get knowledge base entries
    const [total, knowledge] = await prisma.$transaction([
      prisma.oDXKnowledgeBase.count({ where }),
      prisma.oDXKnowledgeBase.findMany({
        where,
        orderBy: [
          { isVerified: 'desc' },
          { confidence: 'desc' },
          { updatedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Get entity details for each knowledge entry
    const enrichedKnowledge = await Promise.all(
      knowledge.map(async (item) => {
        let entity = null;
        let patternTags = [];

        // Get the actual entity
        switch (item.entityType) {
          case 'DTCDOP':
            entity = await prisma.dTCDOP.findUnique({
              where: { id: item.entityId },
              include: { diagnosticLayer: true },
            });
            break;
          case 'DiagService':
            entity = await prisma.diagService.findUnique({
              where: { id: item.entityId },
              include: { diagnosticLayer: true },
            });
            break;
          case 'ODXDiscoveryResult':
            entity = await prisma.oDXDiscoveryResult.findUnique({
              where: { id: item.entityId },
              include: { job: true },
            });
            break;
        }

        // Get tags
        const tagRelations = await prisma.oDXPatternTag.findMany({
          where: {
            entityType: item.entityType,
            entityId: item.entityId,
          },
          include: {
            tag: true,
          },
        });

        patternTags = tagRelations.map(pt => pt.tag);

        // Filter by tags if specified
        if (tags.length > 0) {
          const hasAllTags = tags.every(tag =>
            patternTags.some(pt => pt.name === tag)
          );
          if (!hasAllTags) return null;
        }

        return {
          ...item,
          entity,
          tags: patternTags,
        };
      })
    );

    // Filter out null entries (didn't match tag filter)
    const filteredKnowledge = enrichedKnowledge.filter(k => k !== null);

    return NextResponse.json({
      data: filteredKnowledge,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base' },
      { status: 500 }
    );
  }
}

// POST /api/odx/knowledge/export - Export knowledge base to ODX XML
export async function POST(request: NextRequest) {
  try {
    // AUTH DISABLED;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { entityTypes = ['DTCDOP', 'DiagService'], includeUnverified = false } = body;

    const where: any = {
      entityType: { in: entityTypes },
    };

    if (!includeUnverified) {
      where.isVerified = true;

    const knowledge = await prisma.oDXKnowledgeBase.findMany({
      where,
      include: {
        creator: {
          select: { name: true, email: true },
        },
        verifier: {
          select: { name: true, email: true },
        },
      },
    });

    // Generate ODX XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ODX MODEL-VERSION="2.2.0">\n';
    xml += '  <CATALOG>\n';
    xml += '    <KNOWLEDGE-BASE>\n';

    for (const item of knowledge) {
      xml += '      <KNOWLEDGE-ENTRY>\n';
      xml += `        <SHORT-NAME>${item.id}</SHORT-NAME>\n`;
      xml += `        <ENTITY-TYPE>${item.entityType}</ENTITY-TYPE>\n`;
      xml += `        <ENTITY-ID>${item.entityId}</ENTITY-ID>\n`;

      if (item.userDescription) {
        xml += '        <USER-DESCRIPTION>\n';
        xml += `          <![CDATA[${item.userDescription}]]>\n`;
        xml += '        </USER-DESCRIPTION>\n';
      }

      if (item.technicalNotes) {
        xml += '        <TECHNICAL-NOTES>\n';
        xml += `          <![CDATA[${item.technicalNotes}]]>\n`;
        xml += '        </TECHNICAL-NOTES>\n';
      }

      if (item.entityType === 'DTCDOP') {
        if (item.symptoms) {
          xml += '        <SYMPTOMS>\n';
          xml += `          <![CDATA[${item.symptoms}]]>\n`;
          xml += '        </SYMPTOMS>\n';
        }
        if (item.solutions) {
          xml += '        <SOLUTIONS>\n';
          xml += `          <![CDATA[${item.solutions}]]>\n`;
          xml += '        </SOLUTIONS>\n';
        }
      }

      if (item.entityType === 'DiagService') {
        if (item.preconditions) {
          xml += '        <PRECONDITIONS>\n';
          xml += `          <![CDATA[${item.preconditions}]]>\n`;
          xml += '        </PRECONDITIONS>\n';
        }
        if (item.expectedResults) {
          xml += '        <EXPECTED-RESULTS>\n';
          xml += `          <![CDATA[${item.expectedResults}]]>\n`;
          xml += '        </EXPECTED-RESULTS>\n';
        }
      }

      xml += `        <CONFIDENCE>${item.confidence}</CONFIDENCE>\n`;
      xml += `        <IS-VERIFIED>${item.isVerified}</IS-VERIFIED>\n`;

      if (item.verifier) {
        xml += `        <VERIFIED-BY>${item.verifier.email}</VERIFIED-BY>\n`;
        xml += `        <VERIFIED-AT>${item.verifiedAt?.toISOString()}</VERIFIED-AT>\n`;
      }

      xml += `        <CREATED-BY>${item.creator.email}</CREATED-BY>\n`;
      xml += `        <CREATED-AT>${item.createdAt.toISOString()}</CREATED-AT>\n`;
      xml += `        <UPDATED-AT>${item.updatedAt.toISOString()}</UPDATED-AT>\n`;
      xml += '      </KNOWLEDGE-ENTRY>\n';

    xml += '    </KNOWLEDGE-BASE>\n';
    xml += '  </CATALOG>\n';
    xml += '</ODX>\n';

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="odx-knowledge-${new Date().toISOString().split('T')[0]}.xml"`,
      },
    });
  } catch (error) {
    console.error('Error exporting knowledge base:', error);
    return NextResponse.json(
      { error: 'Failed to export knowledge base' },
      { status: 500 }
    );
  }
}

// GET /api/odx/knowledge/audit - Get audit trail for an entity
export async function GET_AUDIT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );

    const [total, audits] = await prisma.$transaction([
      prisma.oDXAuditLog.count({
        where: { entityType, entityId },
      }),
      prisma.oDXAuditLog.findMany({
        where: { entityType, entityId },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: audits,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    );
  }
}

// GET /api/odx/knowledge/tags - Get all available tags
export async function GET_TAGS(request: NextRequest) {
  try {
    const tags = await prisma.oDXTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { patterns: true },
        },
      },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}