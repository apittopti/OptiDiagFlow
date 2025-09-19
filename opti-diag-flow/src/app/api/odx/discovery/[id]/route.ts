import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/odx/discovery/[id] - Get discovery result with knowledge base info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const discovery = await prisma.oDXDiscoveryResult.findUnique({
      where: { id: params.id },
      include: {
        job: true,
      },
    });

    if (!discovery) {
      return NextResponse.json({ error: 'Discovery result not found' }, { status: 404 });

    // Get knowledge base info
    const knowledge = await prisma.oDXKnowledgeBase.findUnique({
      where: {
        entityType_entityId: {
          entityType: 'ODXDiscoveryResult',
          entityId: params.id,
        },
      },
      include: {
        creator: {
          select: { name: true, email: true },
        },
        updater: {
          select: { name: true, email: true },
        },
        verifier: {
          select: { name: true, email: true },
        },
      },
    });

    // Get tags
    const tags = await prisma.oDXPatternTag.findMany({
      where: {
        entityType: 'ODXDiscoveryResult',
        entityId: params.id,
      },
      include: {
        tag: true,
      },
    });

    return NextResponse.json({
      ...discovery,
      knowledge,
      tags: tags.map(pt => pt.tag),
    });
  } catch (error) {
    console.error('Error fetching discovery result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discovery result' },
      { status: 500 }
    );
  }
}

// PATCH /api/odx/discovery/[id] - Update discovery result and knowledge
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const {
      isConfirmed,
      confidence: newConfidence,
      metadata,
      userDescription,
      technicalNotes,
      isVerified,
      tags,
      reason,
    } = body;

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      let updatedDiscovery = null;

      // Update discovery result if provided
      const updateData: any = {};
      if (isConfirmed !== undefined) updateData.isConfirmed = isConfirmed;
      if (newConfidence !== undefined) updateData.confidence = newConfidence;
      if (metadata !== undefined) updateData.metadata = metadata;

      if (Object.keys(updateData).length > 0) {
        const oldDiscovery = await tx.oDXDiscoveryResult.findUnique({
          where: { id: params.id },
        });

        updatedDiscovery = await tx.oDXDiscoveryResult.update({
          where: { id: params.id },
          data: updateData,
        });

        // Create audit logs
        for (const [field, value] of Object.entries(updateData)) {
          await tx.oDXAuditLog.create({
            data: {
              entityType: 'ODXDiscoveryResult',
              entityId: params.id,
              fieldName: field,
              oldValue: JSON.stringify((oldDiscovery as any)[field]),
              newValue: JSON.stringify(value),
              userId: user.id,
              reason,
            },
          });
        }
      }

      // Update or create knowledge base entry
      let knowledge = await tx.oDXKnowledgeBase.findUnique({
        where: {
          entityType_entityId: {
            entityType: 'ODXDiscoveryResult',
            entityId: params.id,
          },
        },
      });

      if (knowledge) {
        // Save version history before updating
        const currentVersion = await tx.oDXDescriptionVersion.count({
          where: { knowledgeBaseId: knowledge.id },
        });

        await tx.oDXDescriptionVersion.create({
          data: {
            knowledgeBaseId: knowledge.id,
            version: currentVersion + 1,
            userDescription: knowledge.userDescription,
            technicalNotes: knowledge.technicalNotes,
            changedBy: user.id,
            changeReason: reason,
          },
        });

        // Update knowledge base
        knowledge = await tx.oDXKnowledgeBase.update({
          where: { id: knowledge.id },
          data: {
            userDescription,
            technicalNotes,
            updatedBy: user.id,
            usageCount: {
              increment: 1,
            },
            lastUsedAt: new Date(),
            ...(isVerified !== undefined && {
              isVerified,
              verifiedBy: isVerified ? user.id : null,
              verifiedAt: isVerified ? new Date() : null,
            }),
          },
        });

        // Log changes to audit
        const fields = {
          userDescription,
          technicalNotes,
        };

        for (const [field, value] of Object.entries(fields)) {
          if (value !== undefined) {
            await tx.oDXAuditLog.create({
              data: {
                entityType: 'ODXDiscoveryResult',
                entityId: params.id,
                fieldName: field,
                oldValue: (knowledge as any)[field],
                newValue: value,
                userId: user.id,
                reason,
              },
            });
          }
        }
      } else {
        // Create new knowledge base entry
        knowledge = await tx.oDXKnowledgeBase.create({
          data: {
            entityType: 'ODXDiscoveryResult',
            entityId: params.id,
            userDescription,
            technicalNotes,
            createdBy: user.id,
            usageCount: 1,
            lastUsedAt: new Date(),
            ...(isVerified && {
              isVerified,
              verifiedBy: user.id,
              verifiedAt: new Date(),
            }),
          },
        });
      }

      // Handle tags
      if (tags && Array.isArray(tags)) {
        // Remove existing tags
        await tx.oDXPatternTag.deleteMany({
          where: {
            entityType: 'ODXDiscoveryResult',
            entityId: params.id,
          },
        });

        // Add new tags
        for (const tagName of tags) {
          // Create tag if it doesn't exist
          const tag = await tx.oDXTag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          // Link tag to pattern
          await tx.oDXPatternTag.create({
            data: {
              tagId: tag.id,
              entityType: 'ODXDiscoveryResult',
              entityId: params.id,
            },
          });
        }
      }

      return {
        discovery: updatedDiscovery,
        knowledge,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating discovery result:', error);
    return NextResponse.json(
      { error: 'Failed to update discovery result' },
      { status: 500 }
    );
  }
}

// POST /api/odx/discovery/[id]/confirm - Confirm a discovery result
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // AUTH DISABLED;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const discovery = await prisma.oDXDiscoveryResult.update({
      where: { id: params.id },
      data: {
        isConfirmed: true,
        confidence: 'HIGH',
      },
    });

    // Create audit log
    await prisma.oDXAuditLog.create({
      data: {
        entityType: 'ODXDiscoveryResult',
        entityId: params.id,
        fieldName: 'isConfirmed',
        oldValue: 'false',
        newValue: 'true',
        userId: user.id,
        reason: 'Pattern confirmed by user',
      },
    });

    return NextResponse.json(discovery);
  } catch (error) {
    console.error('Error confirming discovery result:', error);
    return NextResponse.json(
      { error: 'Failed to confirm discovery result' },
      { status: 500 }
    );
  }
}