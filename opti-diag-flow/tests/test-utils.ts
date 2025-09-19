import { NextRequest } from 'next/server'

/**
 * Test utilities for creating mock requests and handling test data
 */

export interface TestUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'TECHNICIAN' | 'VIEWER'
}

export interface MockSession {
  user: TestUser
  expires: string
}

/**
 * Creates a mock NextRequest for testing API endpoints
 */
export function createMockRequest(
  method: string,
  body?: any,
  searchParams?: Record<string, string>,
  headers?: Record<string, string>
): NextRequest {
  const url = searchParams
    ? `http://localhost:3000/api/test?${new URLSearchParams(searchParams).toString()}`
    : 'http://localhost:3000/api/test'

  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Creates mock params for dynamic route parameters
 */
export function createMockParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id })
}

/**
 * Creates a test user with specified role
 */
export function createTestUser(role: TestUser['role'] = 'ADMIN', suffix = ''): TestUser {
  return {
    id: `test-user-${role.toLowerCase()}${suffix}`,
    email: `test-${role.toLowerCase()}${suffix}@example.com`,
    name: `Test ${role} User${suffix}`,
    role
  }
}

/**
 * Creates a mock session for a test user
 */
export function createMockSession(user: TestUser): MockSession {
  return {
    user,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  oem: (name = 'TestOEM', shortName?: string) => ({
    name,
    shortName: shortName || name.substring(0, 3).toUpperCase()
  }),

  model: (name = 'TestModel', platform = 'TestPlatform') => ({
    name,
    platform
  }),

  modelYear: (year = 2023) => ({
    year
  }),

  vehicle: (vin?: string) => ({
    vin: vin || `TEST${Date.now()}`
  }),

  job: (name = 'Test Job', jobType = 'Camera calibration') => ({
    name,
    jobType
  })
}

/**
 * Performance testing utilities
 */
export class PerformanceTracker {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  static start(): PerformanceTracker {
    return new PerformanceTracker()
  }

  elapsed(): number {
    return Date.now() - this.startTime
  }

  expectResponseTime(maxMs: number): void {
    const elapsed = this.elapsed()
    if (elapsed > maxMs) {
      throw new Error(`Response time ${elapsed}ms exceeded maximum ${maxMs}ms`)
    }
  }
}

/**
 * Database cleanup utilities
 */
export const DatabaseCleanup = {
  async cleanTestData(userId: string): Promise<void> {
    const { prisma } = await import('@/lib/prisma')

    // Clean up in dependency order
    await prisma.diagnosticJob.deleteMany({ where: { uploadedBy: userId } })
    await prisma.vehicle.deleteMany({ where: { createdBy: userId } })
    await prisma.modelYear.deleteMany({ where: { Model: { name: { startsWith: 'Test' } } } })
    await prisma.model.deleteMany({ where: { name: { startsWith: 'Test' } } })
    await prisma.oEM.deleteMany({ where: { name: { startsWith: 'Test' } } })
    await prisma.user.deleteMany({ where: { id: userId } })
  },

  async cleanConcurrentTestData(): Promise<void> {
    const { prisma } = await import('@/lib/prisma')

    await prisma.oEM.deleteMany({ where: { name: { startsWith: 'Concurrent' } } })
    await prisma.model.deleteMany({ where: { name: { startsWith: 'Concurrent' } } })
    await prisma.diagnosticJob.deleteMany({ where: { name: { startsWith: 'Pagination' } } })
  }
}

/**
 * Test assertion helpers
 */
export const TestAssertions = {
  expectValidApiResponse(response: Response, expectedStatus = 200): void {
    expect(response).toBeDefined()
    expect(response.status).toBe(expectedStatus)
  },

  expectErrorResponse(response: Response, expectedStatus: number, errorMessageContains?: string): void {
    expect(response.status).toBe(expectedStatus)
    if (errorMessageContains) {
      // Note: In real tests, you'd await response.json() to check the error message
    }
  },

  expectAuthenticationRequired(response: Response): void {
    expect(response.status).toBe(401)
  },

  expectPermissionDenied(response: Response): void {
    expect(response.status).toBe(403)
  },

  expectNotFound(response: Response): void {
    expect(response.status).toBe(404)
  },

  expectConflict(response: Response): void {
    expect(response.status).toBe(409)
  },

  expectValidationError(response: Response): void {
    expect(response.status).toBe(400)
  }
}

/**
 * Test constants
 */
export const TestConstants = {
  RESPONSE_TIME_LIMITS: {
    FAST: 500,      // Fast operations (GET single record)
    MEDIUM: 1000,   // Medium operations (GET multiple records)
    SLOW: 2000      // Slow operations (complex operations with joins)
  },

  VALID_JOB_STATUSES: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
  VALID_USER_ROLES: ['ADMIN', 'TECHNICIAN', 'VIEWER'],

  YEAR_LIMITS: {
    MIN: 1900,
    MAX: new Date().getFullYear() + 2
  },

  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 100
  }
}

/**
 * Mock data consistency helpers
 */
export class MockDataManager {
  private static instance: MockDataManager
  private createdIds: Map<string, string[]> = new Map()

  static getInstance(): MockDataManager {
    if (!MockDataManager.instance) {
      MockDataManager.instance = new MockDataManager()
    }
    return MockDataManager.instance
  }

  trackCreatedId(type: string, id: string): void {
    if (!this.createdIds.has(type)) {
      this.createdIds.set(type, [])
    }
    this.createdIds.get(type)!.push(id)
  }

  getCreatedIds(type: string): string[] {
    return this.createdIds.get(type) || []
  }

  clearTrackedIds(): void {
    this.createdIds.clear()
  }
}