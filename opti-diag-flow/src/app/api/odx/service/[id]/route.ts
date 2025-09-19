import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/odx/service/[id] - Get service with knowledge base info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await prisma.diagService.findUnique({
      where: { id: params.id },
      include: {
        diagnosticLayer: true,
        requestParams: true,
        responseParams: true,
      },
    });

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    // Get knowledge base info
    const knowledge = await prisma.oDXKnowledgeBase.findUnique({
      where: {
        entityType_entityId: {
          entityType: 'DiagService',
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
        entityType: 'DiagService',
        entityId: params.id,
      },
      include: {
        tag: true,
      },
    });

    return NextResponse.json({
      ...service,
      knowledge,
      tags: tags.map(pt => pt.tag),
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

// PATCH /api/odx/service/[id] - Update service description and knowledge
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
      longName,
      semantic,
      userDescription,
      technicalNotes,
      preconditions,
      expectedResults,
      isVerified,
      confidence,
      tags,
      reason,
    } = body;

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      let updatedService = null;

      // Update service fields if provided
      if (longName !== undefined || semantic !== undefined) {
        const oldService = await tx.diagService.findUnique({
          where: { id: params.id },
        });

        const updateData: any = {};
        if (longName !== undefined) updateData.longName = longName;
        if (semantic !== undefined) updateData.semantic = semantic;

        updatedService = await tx.diagService.update({
          where: { id: params.id },
          data: updateData,
        });

        // Create audit logs
        for (const [field, value] of Object.entries(updateData)) {
          await tx.oDXAuditLog.create({
            data: {
              entityType: 'DiagService',
              entityId: params.id,
              fieldName: field,
              oldValue: (oldService as any)[field],
              newValue: value,
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
            entityType: 'DiagService',
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
            preconditions: knowledge.preconditions,
            expectedResults: knowledge.expectedResults,
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
            preconditions,
            expectedResults,
            updatedBy: user.id,
            ...(isVerified !== undefined && {
              isVerified,
              verifiedBy: isVerified ? user.id : null,
              verifiedAt: isVerified ? new Date() : null,
            }),
            ...(confidence !== undefined && { confidence }),
          },
        });

        // Log changes to audit
        const fields = {
          userDescription,
          technicalNotes,
          preconditions,
          expectedResults,
        };

        for (const [field, value] of Object.entries(fields)) {
          if (value !== undefined) {
            await tx.oDXAuditLog.create({
              data: {
                entityType: 'DiagService',
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
            entityType: 'DiagService',
            entityId: params.id,
            userDescription,
            technicalNotes,
            preconditions,
            expectedResults,
            createdBy: user.id,
            ...(isVerified && {
              isVerified,
              verifiedBy: user.id,
              verifiedAt: new Date(),
            }),
            ...(confidence !== undefined && { confidence }),
          },
        });
      }

      // Handle tags
      if (tags && Array.isArray(tags)) {
        // Remove existing tags
        await tx.oDXPatternTag.deleteMany({
          where: {
            entityType: 'DiagService',
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
              entityType: 'DiagService',
              entityId: params.id,
            },
          });
        }
      }

      return {
        service: updatedService,
        knowledge,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// DELETE /api/odx/service/[id]/knowledge - Delete knowledge base entry
export async function DELETE(
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

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await prisma.$transaction(async (tx) => {
      // Delete knowledge base entry and related data
      const knowledge = await tx.oDXKnowledgeBase.findUnique({
        where: {
          entityType_entityId: {
            entityType: 'DiagService',
            entityId: params.id,
          },
        },
      });

      if (knowledge) {
        // Delete version history
        await tx.oDXDescriptionVersion.deleteMany({
          where: { knowledgeBaseId: knowledge.id },
        });

        // Delete knowledge base entry
        await tx.oDXKnowledgeBase.delete({
          where: { id: knowledge.id },
        });
      }

      // Delete tags
      await tx.oDXPatternTag.deleteMany({
        where: {
          entityType: 'DiagService',
          entityId: params.id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to delete service knowledge' },
      { status: 500 }
    );
  }
}