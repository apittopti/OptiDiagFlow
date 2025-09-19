import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

// Mock Prisma client for testing
export const mockPrisma = {
  oEM: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  model: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  modelYear: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  vehicle: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  diagnosticJob: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  tag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaClient

// Mock authentication session
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ADMIN'
  },
  expires: '2025-12-31T23:59:59.999Z'
}

export const mockUnauthorizedSession = null

// Helper to create mock NextRequest
export function createMockRequest(
  method: string,
  url: string = 'http://localhost:3000/api/test',
  body?: any,
  searchParams?: Record<string, string>
): NextRequest {
  const fullUrl = new URL(url)

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value)
    })
  }

  const request = new NextRequest(fullUrl.toString(), {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
    },
  })

  return request
}

// Helper to create mock params
export function createMockParams(id: string) {
  return Promise.resolve({ id })
}

// Sample test data
export const sampleOEM = {
  id: 'oem-test-id',
  name: 'Test OEM',
  shortName: 'TO',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  _count: { Model: 0 }
}

export const sampleModel = {
  id: 'model-test-id',
  name: 'Test Model',
  oemId: 'oem-test-id',
  platform: 'Test Platform',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  OEM: {
    id: 'oem-test-id',
    name: 'Test OEM',
    shortName: 'TO'
  },
  _count: { ModelYear: 0 }
}

export const sampleModelYear = {
  id: 'model-year-test-id',
  modelId: 'model-test-id',
  year: 2023,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  Model: {
    id: 'model-test-id',
    name: 'Test Model',
    oemId: 'oem-test-id',
    OEM: {
      id: 'oem-test-id',
      name: 'Test OEM',
      shortName: 'TO'
    }
  },
  Vehicle: []
}

export const sampleVehicle = {
  id: 'vehicle-test-id',
  vin: 'TEST123456789',
  modelYearId: 'model-year-test-id',
  createdBy: 'test-user-id',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01')
}

export const sampleJob = {
  id: 'job-test-id',
  name: 'Test Job',
  description: 'Test diagnostic job',
  vehicleId: 'vehicle-test-id',
  uploadedBy: 'test-user-id',
  status: 'ACTIVE',
  procedureType: 'Diagnostic',
  duration: 300,
  messageCount: 100,
  metadata: { test: 'data' },
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  Vehicle: sampleVehicle,
  User: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com'
  },
  Tag: []
}

// Reset all mocks
export function resetMocks() {
  Object.values(mockPrisma).forEach((model: any) => {
    Object.values(model).forEach((method: any) => {
      if (jest.isMockFunction(method)) {
        method.mockReset()
      }
    })
  })
}

// Validation helpers
export function validateResponseFormat(response: any, expectedFields: string[]) {
  expect(response).toHaveProperty('status')
  expect(typeof response.status).toBe('number')

  if (response.status === 200 || response.status === 201) {
    expectedFields.forEach(field => {
      expect(response.json).toHaveProperty(field)
    })
  } else {
    expect(response.json).toHaveProperty('error')
  }
}

export function validateTimestamps(obj: any) {
  expect(obj).toHaveProperty('createdAt')
  expect(obj).toHaveProperty('updatedAt')
  expect(new Date(obj.createdAt)).toBeInstanceOf(Date)
  expect(new Date(obj.updatedAt)).toBeInstanceOf(Date)
}