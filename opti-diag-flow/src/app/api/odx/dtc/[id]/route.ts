import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';

// GET /api/odx/dtc/[id] - Get DTC with knowledge base info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dtc = await prisma.dTCDOP.findUnique({
      where: { id: params.id },
      include: {
        diagnosticLayer: true,
        freezeFrames: true,
        environmentContexts: true,
      },
    });

    if (!dtc) {
      return NextResponse.json({ error: 'DTC not found' }, { status: 404 });

    // Get knowledge base info
    const knowledge = await prisma.oDXKnowledgeBase.findUnique({
      where: {
        entityType_entityId: {
          entityType: 'DTCDOP',
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
        entityType: 'DTCDOP',
        entityId: params.id,
      },
      include: {
        tag: true,
      },
    });

    return NextResponse.json({
      ...dtc,
      knowledge,
      tags: tags.map(pt => pt.tag),
    });
  } catch (error) {
    console.error('Error fetching DTC:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DTC' },
      { status: 500 }
    );
  }
}

// PATCH /api/odx/dtc/[id] - Update DTC description and knowledge
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
      description,
      userDescription,
      technicalNotes,
      symptoms,
      solutions,
      isVerified,
      confidence,
      tags,
      reason,
    } = body;

    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      let updatedDtc = null;

      // Update DTC description if provided
      if (description !== undefined) {
        const oldDtc = await tx.dTCDOP.findUnique({
          where: { id: params.id },
        });

        updatedDtc = await tx.dTCDOP.update({
          where: { id: params.id },
          data: { description },
        });

        // Create audit log
        await tx.oDXAuditLog.create({
          data: {
            entityType: 'DTCDOP',
            entityId: params.id,
            fieldName: 'description',
            oldValue: oldDtc?.description,
            newValue: description,
            userId: user.id,
            reason,
          },
        });
      }

      // Update or create knowledge base entry
      let knowledge = await tx.oDXKnowledgeBase.findUnique({
        where: {
          entityType_entityId: {
            entityType: 'DTCDOP',
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
            symptoms: knowledge.symptoms,
            solutions: knowledge.solutions,
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
            symptoms,
            solutions,
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
          symptoms,
          solutions,
        };

        for (const [field, value] of Object.entries(fields)) {
          if (value !== undefined) {
            await tx.oDXAuditLog.create({
              data: {
                entityType: 'DTCDOP',
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
            entityType: 'DTCDOP',
            entityId: params.id,
            userDescription,
            technicalNotes,
            symptoms,
            solutions,
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
            entityType: 'DTCDOP',
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
              entityType: 'DTCDOP',
              entityId: params.id,
            },
          });
        }
      }

      return {
        dtc: updatedDtc,
        knowledge,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating DTC:', error);
    return NextResponse.json(
      { error: 'Failed to update DTC' },
      { status: 500 }
    );
  }
}

// DELETE /api/odx/dtc/[id]/knowledge - Delete knowledge base entry
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
            entityType: 'DTCDOP',
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
          entityType: 'DTCDOP',
          entityId: params.id,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting DTC knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to delete DTC knowledge' },
      { status: 500 }
    );
  }
}