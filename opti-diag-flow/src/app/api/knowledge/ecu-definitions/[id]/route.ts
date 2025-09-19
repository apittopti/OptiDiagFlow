import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// GET - Get specific ECU definition
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const definition = await prisma.eCUDefinition.findUnique({
      where: { id: params.id },
      include: {
        source: true,
        oem: true,
        model: true,
        modelYear: true,
        vehicle: true,
        auditLogs: {
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!definition) {
      return NextResponse.json(
        { error: 'ECU definition not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(definition);
  } catch (error) {
    console.error('Error fetching ECU definition:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ECU definition' },
      { status: 500 }
    );
  }
}

// PATCH - Update ECU definition
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      confidence,
      isVerified,
      reason,
    } = body;

    // Get existing definition
    const existing = await prisma.eCUDefinition.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'ECU definition not found' },
        { status: 404 }
      );
    }

    // Update definition
    const updated = await prisma.eCUDefinition.update({
      where: { id: params.id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
        category: category !== undefined ? category : existing.category,
        confidence: confidence !== undefined ? confidence : existing.confidence,
        isVerified: isVerified !== undefined ? isVerified : existing.isVerified,
        version: existing.version + 1,
        modifiedBy: session.user.email,
        auditLogs: {
          create: {
            action: isVerified && !existing.isVerified ? 'VERIFY' : 'UPDATE',
            previousValue: existing,
            newValue: body,
            changedBy: session.user.email,
            reason: reason || 'Manual update via API',
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating ECU definition:', error);
    return NextResponse.json(
      { error: 'Failed to update ECU definition' },
      { status: 500 }
    );
  }
}

// DELETE - Delete ECU definition
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const definition = await prisma.eCUDefinition.findUnique({
      where: { id: params.id },
    });

    if (!definition) {
      return NextResponse.json(
        { error: 'ECU definition not found' },
        { status: 404 }
      );
    }

    // Create deletion audit log
    await prisma.eCUDefinitionAudit.create({
      data: {
        definitionId: params.id,
        action: 'DELETE',
        previousValue: definition as any,
        changedBy: session.user.email,
        reason: 'Manual deletion via API',
      },
    });

    // Delete the definition
    await prisma.eCUDefinition.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ECU definition:', error);
    return NextResponse.json(
      { error: 'Failed to delete ECU definition' },
      { status: 500 }
    );
  }
}