import { NextRequest, NextResponse } from 'next/server';
import { resolveECUDefinition, getInheritanceChain } from '@/lib/knowledge-resolver';

// POST - Resolve ECU definition with inheritance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, context, includeChain = false } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'ECU address is required' },
        { status: 400 }
      );
    }

    // Resolve the most specific definition
    const definition = await resolveECUDefinition(address, context || {});

    if (!definition) {
      return NextResponse.json(
        { error: 'No ECU definition found' },
        { status: 404 }
      );
    }

    let response: any = { definition };

    // Include inheritance chain if requested
    if (includeChain) {
      const chain = await getInheritanceChain(address, context || {}, 'ECU');
      response.inheritanceChain = chain;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error resolving ECU definition:', error);
    return NextResponse.json(
      { error: 'Failed to resolve ECU definition' },
      { status: 500 }
    );
  }
}