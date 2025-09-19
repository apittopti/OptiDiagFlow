import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { ODXDiscoveryEngine } from '@/lib/odx-discovery-engine';

// POST - Discover ODX patterns from trace session
export async function POST(request: NextRequest) {
  try {
    // AUTH DISABLED;

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );

    // Get the trace session with messages
    const traceSession = await prisma.traceSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!traceSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );

    // Initialize discovery engine
    const discoveryEngine = new ODXDiscoveryEngine();

    // Process messages for discovery
    const discoveredPatterns = await discoveryEngine.processTraceSession({
      messages: traceSession.messages.map(msg => ({
        timestamp: msg.timestamp,
        sourceAddr: msg.sourceAddr,
        targetAddr: msg.targetAddr,
        data: msg.data,
        isRequest: msg.isRequest,
        isResponse: msg.isResponse,
        serviceCode: msg.serviceCode || undefined,
        serviceName: msg.serviceName || undefined
      }))
    });

    // Store discovered services in database
    const createdServices = [];
    for (const service of discoveredPatterns.services) {
      const odxService = await prisma.oDXDiagService.create({
        data: {
          sessionId,
          shortName: service.shortName,
          longName: service.longName,
          semantic: service.semantic,
          requestSID: service.serviceId,
          discoveredFrom: traceSession.fileName,
          confidence: service.confidence || 0.8,
          requestParams: {
            create: service.requestParams?.map((param: any) => ({
              shortName: param.name,
              semantic: param.semantic,
              bytePosition: param.bytePosition,
              bitPosition: param.bitPosition,
              bitLength: param.bitLength,
              dataType: param.dataType,
              dataLength: param.dataLength
            })) || []
          },
          responseParams: {
            create: service.responseParams?.map((param: any) => ({
              shortName: param.name,
              semantic: param.semantic,
              bytePosition: param.bytePosition,
              bitPosition: param.bitPosition,
              bitLength: param.bitLength,
              dataType: param.dataType,
              dataLength: param.dataLength,
              unit: param.unit
            })) || []
          }
        },
        include: {
          requestParams: true,
          responseParams: true
        }
      });
      createdServices.push(odxService);

    // Store discovered ECUs
    const createdEcus = [];
    for (const ecu of discoveredPatterns.ecus) {
      // Get the vehicle from the trace session
      const job = await prisma.diagnosticJob.findFirst({
        where: { id: traceSession.jobId },
        include: { Vehicle: true }
      });

      if (job?.Vehicle) {
        const ecuInstance = await prisma.eCUInstance.upsert({
          where: {
            vehicleId_ecuAddress: {
              vehicleId: job.Vehicle.id,
              ecuAddress: ecu.address
            }
          },
          update: {
            ecuName: ecu.name || undefined,
            ecuType: ecu.type || undefined
          },
          create: {
            vehicleId: job.Vehicle.id,
            ecuAddress: ecu.address,
            ecuName: ecu.name,
            ecuType: ecu.type
          }
        });
        createdEcus.push(ecuInstance);
      }

    return NextResponse.json({
      success: true,
      discoveredPatterns: {
        services: createdServices,
        ecus: createdEcus,
        dtcs: discoveredPatterns.dtcs || []
      },
      summary: {
        servicesFound: createdServices.length,
        ecusFound: createdEcus.length,
        dtcsFound: discoveredPatterns.dtcs?.length || 0
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error discovering ODX patterns:', error);
    return NextResponse.json(
      { error: 'Failed to discover ODX patterns' },
      { status: 500 }
    );
  }
}