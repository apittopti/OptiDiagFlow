import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

// Import API handlers
import { GET as getOEMs, POST as createOEM } from '@/app/api/oems/route'
import { GET as getOEM, PUT as updateOEM, DELETE as deleteOEM } from '@/app/api/oems/[id]/route'
import { GET as getModelYears, POST as createModelYear } from '@/app/api/model-years/route'
import { GET as getModelYear, PUT as updateModelYear, DELETE as deleteModelYear } from '@/app/api/model-years/[id]/route'
import { GET as getJobs, POST as createJob, PATCH as updateJob } from '@/app/api/jobs/route'

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

// Test data
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN' as const
}

const mockSession = {
  user: testUser,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

// Helper function to create mock request
function createMockRequest(method: string, body?: any, searchParams?: Record<string, string>): NextRequest {
  const url = searchParams
    ? `http://localhost:3000/api/test?${new URLSearchParams(searchParams).toString()}`
    : 'http://localhost:3000/api/test'

  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  return request
}

// Helper function to create mock params
function createMockParams(id: string) {
  return Promise.resolve({ id })
}

describe('CRUD Operations Validation Test Suite', () => {
  let testOEMId: string
  let testModelId: string
  let testModelYearId: string
  let testVehicleId: string
  let testJobId: string

  beforeAll(async () => {
    // Set up authenticated session
    mockGetServerSession.mockResolvedValue(mockSession)

    // Clean up test data from previous runs
    await prisma.diagnosticJob.deleteMany({ where: { uploadedBy: testUser.id } })
    await prisma.vehicle.deleteMany({ where: { createdBy: testUser.id } })
    await prisma.modelYear.deleteMany({ where: { Model: { name: 'TestModel' } } })
    await prisma.model.deleteMany({ where: { name: 'TestModel' } })
    await prisma.oEM.deleteMany({ where: { name: 'TestOEM' } })

    // Create test user if not exists
    await prisma.user.upsert({
      where: { id: testUser.id },
      update: {},
      create: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role
      }
    })
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.diagnosticJob.deleteMany({ where: { uploadedBy: testUser.id } })
    await prisma.vehicle.deleteMany({ where: { createdBy: testUser.id } })
    await prisma.modelYear.deleteMany({ where: { Model: { name: 'TestModel' } } })
    await prisma.model.deleteMany({ where: { name: 'TestModel' } })
    await prisma.oEM.deleteMany({ where: { name: 'TestOEM' } })
    await prisma.user.deleteMany({ where: { id: testUser.id } })

    // Reset mocks
    jest.clearAllMocks()
  })

  beforeEach(async () => {
    // Ensure authenticated session for each test
    mockGetServerSession.mockResolvedValue(mockSession)
  })

  afterEach(async () => {
    jest.clearAllMocks()
  })

  describe('1. API Endpoint Testing with Authentication', () => {
    describe('OEM CRUD Operations', () => {
      it('should require authentication for all operations', async () => {
        mockGetServerSession.mockResolvedValue(null)

        const getResponse = await getOEMs()
        expect(getResponse.status).toBe(401)

        const createRequest = createMockRequest('POST', { name: 'TestOEM', shortName: 'TO' })
        const createResponse = await createOEM(createRequest)
        expect(createResponse.status).toBe(401)
      })

      it('should create a new OEM with valid data', async () => {
        const request = createMockRequest('POST', { name: 'TestOEM', shortName: 'TO' })
        const response = await createOEM(request)

        expect(response.status).toBe(201)
        const data = await response.json()
        expect(data.name).toBe('TestOEM')
        expect(data.shortName).toBe('TO')
        testOEMId = data.id
      })

      it('should get all OEMs', async () => {
        const response = await getOEMs()
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.some((oem: any) => oem.id === testOEMId)).toBe(true)
      })

      it('should get a specific OEM by ID', async () => {
        const response = await getOEM(
          createMockRequest('GET'),
          { params: createMockParams(testOEMId) }
        )
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.id).toBe(testOEMId)
        expect(data.name).toBe('TestOEM')
      })

      it('should update an existing OEM', async () => {
        const request = createMockRequest('PUT', { name: 'UpdatedTestOEM', shortName: 'UTO' })
        const response = await updateOEM(
          request,
          { params: createMockParams(testOEMId) }
        )

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.name).toBe('UpdatedTestOEM')
        expect(data.shortName).toBe('UTO')
      })

      it('should return 404 for non-existent OEM', async () => {
        const response = await getOEM(
          createMockRequest('GET'),
          { params: createMockParams('non-existent-id') }
        )
        expect(response.status).toBe(404)
      })

      it('should return 409 for duplicate OEM names', async () => {
        const request = createMockRequest('POST', { name: 'UpdatedTestOEM', shortName: 'UTO2' })
        const response = await createOEM(request)
        expect(response.status).toBe(409)
      })
    })

    describe('Model Year CRUD Operations', () => {
      beforeAll(async () => {
        // Create a test model for model year operations
        const model = await prisma.model.create({
          data: {
            name: 'TestModel',
            oemId: testOEMId,
            platform: 'TestPlatform'
          }
        })
        testModelId = model.id
      })

      it('should create a new model year with valid data', async () => {
        const request = createMockRequest('POST', { year: 2023, modelId: testModelId })
        const response = await createModelYear(request)

        expect(response.status).toBe(201)
        const data = await response.json()
        expect(data.year).toBe(2023)
        expect(data.modelId).toBe(testModelId)
        testModelYearId = data.id
      })

      it('should validate year range (1900 to current+2)', async () => {
        const invalidYearLow = createMockRequest('POST', { year: 1899, modelId: testModelId })
        const responseLow = await createModelYear(invalidYearLow)
        expect(responseLow.status).toBe(400)

        const currentYear = new Date().getFullYear()
        const invalidYearHigh = createMockRequest('POST', { year: currentYear + 3, modelId: testModelId })
        const responseHigh = await createModelYear(invalidYearHigh)
        expect(responseHigh.status).toBe(400)
      })

      it('should prevent duplicate year within same model', async () => {
        const request = createMockRequest('POST', { year: 2023, modelId: testModelId })
        const response = await createModelYear(request)
        expect(response.status).toBe(409)
      })

      it('should return 404 for non-existent model', async () => {
        const request = createMockRequest('POST', { year: 2024, modelId: 'non-existent-model' })
        const response = await createModelYear(request)
        expect(response.status).toBe(404)
      })

      it('should get model years with filtering', async () => {
        const response = await getModelYears(
          createMockRequest('GET', undefined, { modelId: testModelId })
        )
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.some((my: any) => my.id === testModelYearId)).toBe(true)
      })
    })

    describe('Diagnostic Job CRUD Operations', () => {
      beforeAll(async () => {
        // Create a test vehicle
        const vehicle = await prisma.vehicle.create({
          data: {
            modelYearId: testModelYearId,
            vin: 'TEST123456789',
            createdBy: testUser.id
          }
        })
        testVehicleId = vehicle.id
      })

      it('should create a new diagnostic job', async () => {
        const request = createMockRequest('POST', {
          name: 'Test Diagnostic Job',
          jobType: 'Camera calibration',
          vehicleModelYearId: testModelYearId,
          vin: 'TEST123456789'
        })
        const response = await createJob(request)

        expect(response.status).toBe(201)
        const data = await response.json()
        expect(data.name).toBe('Test Diagnostic Job')
        expect(data.procedureType).toBe('Camera calibration')
        expect(data.status).toBe('DRAFT')
        testJobId = data.id
      })

      it('should validate required fields for job creation', async () => {
        const request = createMockRequest('POST', {
          name: 'Test Job'
          // Missing jobType and vehicleModelYearId
        })
        const response = await createJob(request)
        expect(response.status).toBe(400)
      })

      it('should update job status with permission check', async () => {
        const request = createMockRequest('PATCH', {
          jobId: testJobId,
          status: 'ACTIVE'
        })
        const response = await updateJob(request)

        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.status).toBe('ACTIVE')
      })

      it('should validate job status values', async () => {
        const request = createMockRequest('PATCH', {
          jobId: testJobId,
          status: 'INVALID_STATUS'
        })
        const response = await updateJob(request)
        expect(response.status).toBe(400)
      })

      it('should deny permission for non-owner updates', async () => {
        const differentUser = { ...mockSession, user: { ...testUser, id: 'different-user', role: 'VIEWER' } }
        mockGetServerSession.mockResolvedValue(differentUser)

        const request = createMockRequest('PATCH', {
          jobId: testJobId,
          status: 'ARCHIVED'
        })
        const response = await updateJob(request)
        expect(response.status).toBe(403)

        // Reset to original user
        mockGetServerSession.mockResolvedValue(mockSession)
      })

      it('should get jobs with filtering and pagination', async () => {
        const response = await getJobs(
          createMockRequest('GET', undefined, {
            vehicleId: testVehicleId,
            limit: '10',
            offset: '0'
          })
        )
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data).toHaveProperty('jobs')
        expect(data).toHaveProperty('total')
        expect(data).toHaveProperty('limit')
        expect(data).toHaveProperty('offset')
        expect(Array.isArray(data.jobs)).toBe(true)
      })
    })
  })

  describe('2. Data Integrity Testing', () => {
    it('should maintain foreign key constraints', async () => {
      // Try to create model year with non-existent model
      const request = createMockRequest('POST', { year: 2024, modelId: 'non-existent' })
      const response = await createModelYear(request)
      expect(response.status).toBe(404)
    })

    it('should prevent cascade deletion when children exist', async () => {
      // Try to delete OEM that has models
      const response = await deleteOEM(
        createMockRequest('DELETE'),
        { params: createMockParams(testOEMId) }
      )
      expect(response.status).toBe(409)

      const responseData = await response.json()
      expect(responseData.error).toContain('Cannot delete OEM with existing models')
    })

    it('should enforce unique constraints', async () => {
      // Try to create duplicate OEM
      const request = createMockRequest('POST', { name: 'UpdatedTestOEM', shortName: 'DUPLICATE' })
      const response = await createOEM(request)
      expect(response.status).toBe(409)
    })

    it('should handle VIN uniqueness constraints', async () => {
      // Try to create vehicle with duplicate VIN
      try {
        await prisma.vehicle.create({
          data: {
            modelYearId: testModelYearId,
            vin: 'TEST123456789', // This VIN already exists
            createdBy: testUser.id
          }
        })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error.code).toBe('P2002') // Prisma unique constraint violation
      }
    })
  })

  describe('3. Business Rule Validation', () => {
    it('should validate year ranges for ModelYear', async () => {
      const currentYear = new Date().getFullYear()

      // Test lower bound
      const requestLow = createMockRequest('POST', { year: 1899, modelId: testModelId })
      const responseLow = await createModelYear(requestLow)
      expect(responseLow.status).toBe(400)

      // Test upper bound
      const requestHigh = createMockRequest('POST', { year: currentYear + 3, modelId: testModelId })
      const responseHigh = await createModelYear(requestHigh)
      expect(responseHigh.status).toBe(400)

      // Test valid year
      const requestValid = createMockRequest('POST', { year: currentYear, modelId: testModelId })
      const responseValid = await createModelYear(requestValid)
      expect(responseValid.status).toBe(201)
    })

    it('should restrict job status to valid values', async () => {
      const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED']

      for (const status of validStatuses) {
        const request = createMockRequest('PATCH', { jobId: testJobId, status })
        const response = await updateJob(request)
        expect(response.status).toBe(200)
      }

      // Test invalid status
      const invalidRequest = createMockRequest('PATCH', { jobId: testJobId, status: 'INVALID' })
      const invalidResponse = await updateJob(invalidRequest)
      expect(invalidResponse.status).toBe(400)
    })

    it('should enforce OEM and Model name uniqueness within scope', async () => {
      // OEM name uniqueness
      const oemRequest = createMockRequest('POST', { name: 'UpdatedTestOEM', shortName: 'ANOTHER' })
      const oemResponse = await createOEM(oemRequest)
      expect(oemResponse.status).toBe(409)

      // Model name uniqueness within OEM
      try {
        await prisma.model.create({
          data: {
            name: 'TestModel', // This name already exists for this OEM
            oemId: testOEMId,
            platform: 'AnotherPlatform'
          }
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe('P2002') // Unique constraint violation
      }
    })

    it('should check permission for job updates', async () => {
      // Test with different user (non-owner, non-admin)
      const viewerUser = {
        ...mockSession,
        user: { ...testUser, id: 'viewer-user', role: 'VIEWER' as const }
      }

      // Create the viewer user
      await prisma.user.upsert({
        where: { id: 'viewer-user' },
        update: {},
        create: {
          id: 'viewer-user',
          email: 'viewer@example.com',
          name: 'Viewer User',
          role: 'VIEWER'
        }
      })

      mockGetServerSession.mockResolvedValue(viewerUser)

      const request = createMockRequest('PATCH', { jobId: testJobId, status: 'ARCHIVED' })
      const response = await updateJob(request)
      expect(response.status).toBe(403)

      // Reset to original user
      mockGetServerSession.mockResolvedValue(mockSession)
    })
  })

  describe('4. Edge Case Testing', () => {
    it('should handle empty request bodies gracefully', async () => {
      const request = createMockRequest('POST', {})
      const response = await createOEM(request)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('required')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{{'
      })

      try {
        await createOEM(request)
      } catch (error) {
        // Should handle JSON parsing error gracefully
        expect(error).toBeDefined()
      }
    })

    it('should handle non-existent ID operations', async () => {
      const nonExistentId = 'non-existent-id-12345'

      // GET non-existent OEM
      const getResponse = await getOEM(
        createMockRequest('GET'),
        { params: createMockParams(nonExistentId) }
      )
      expect(getResponse.status).toBe(404)

      // UPDATE non-existent OEM
      const updateResponse = await updateOEM(
        createMockRequest('PUT', { name: 'Updated', shortName: 'UPD' }),
        { params: createMockParams(nonExistentId) }
      )
      expect(updateResponse.status).toBe(404)

      // DELETE non-existent OEM
      const deleteResponse = await deleteOEM(
        createMockRequest('DELETE'),
        { params: createMockParams(nonExistentId) }
      )
      expect(deleteResponse.status).toBe(404)
    })

    it('should handle concurrent operations', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        createOEM(createMockRequest('POST', {
          name: `ConcurrentOEM${i}`,
          shortName: `CO${i}`
        }))
      )

      const responses = await Promise.all(concurrentRequests)
      const successCount = responses.filter(r => r.status === 201).length
      const conflictCount = responses.filter(r => r.status === 409).length

      // All should succeed since they have different names
      expect(successCount).toBe(5)
      expect(conflictCount).toBe(0)

      // Clean up
      await prisma.oEM.deleteMany({
        where: { name: { startsWith: 'ConcurrentOEM' } }
      })
    })

    it('should validate proper error messages', async () => {
      // Missing required field
      const missingFieldRequest = createMockRequest('POST', { shortName: 'MF' })
      const missingFieldResponse = await createOEM(missingFieldRequest)
      expect(missingFieldResponse.status).toBe(400)

      const missingFieldData = await missingFieldResponse.json()
      expect(missingFieldData.error).toContain('required')

      // Duplicate entry
      const duplicateRequest = createMockRequest('POST', { name: 'UpdatedTestOEM' })
      const duplicateResponse = await createOEM(duplicateRequest)
      expect(duplicateResponse.status).toBe(409)

      const duplicateData = await duplicateResponse.json()
      expect(duplicateData.error).toContain('already exists')
    })
  })

  describe('5. Performance Testing', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now()
      await getOEMs()
      const endTime = Date.now()

      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(1000) // Should respond within 1 second
    })

    it('should handle pagination efficiently', async () => {
      // Create multiple test jobs for pagination testing
      const jobPromises = Array.from({ length: 25 }, (_, i) =>
        createJob(createMockRequest('POST', {
          name: `PaginationJob${i}`,
          jobType: 'Test procedure',
          vehicleModelYearId: testModelYearId
        }))
      )

      await Promise.all(jobPromises)

      // Test pagination
      const page1Response = await getJobs(
        createMockRequest('GET', undefined, { limit: '10', offset: '0' })
      )
      expect(page1Response.status).toBe(200)

      const page1Data = await page1Response.json()
      expect(page1Data.jobs).toHaveLength(10)
      expect(page1Data.total).toBeGreaterThanOrEqual(25)

      const page2Response = await getJobs(
        createMockRequest('GET', undefined, { limit: '10', offset: '10' })
      )
      expect(page2Response.status).toBe(200)

      const page2Data = await page2Response.json()
      expect(page2Data.jobs).toHaveLength(10)

      // Clean up pagination test jobs
      await prisma.diagnosticJob.deleteMany({
        where: { name: { startsWith: 'PaginationJob' } }
      })
    })

    it('should include proper relationships in queries', async () => {
      const response = await getJobs(createMockRequest('GET'))
      expect(response.status).toBe(200)

      const data = await response.json()
      if (data.jobs.length > 0) {
        const job = data.jobs[0]
        expect(job).toHaveProperty('Vehicle')
        expect(job.Vehicle).toHaveProperty('ModelYear')
        expect(job.Vehicle.ModelYear).toHaveProperty('Model')
        expect(job.Vehicle.ModelYear.Model).toHaveProperty('OEM')
        expect(job).toHaveProperty('User')
        expect(job.User).toHaveProperty('name')
      }
    })

    it('should optimize query performance with selective fields', async () => {
      const startTime = Date.now()
      const response = await getJobs(createMockRequest('GET'))
      const endTime = Date.now()

      expect(response.status).toBe(200)
      const responseTime = endTime - startTime
      expect(responseTime).toBeLessThan(2000) // Should be reasonably fast even with joins

      const data = await response.json()
      if (data.jobs.length > 0) {
        const job = data.jobs[0]
        // Should only include selected User fields (not password, etc.)
        expect(job.User).not.toHaveProperty('password')
        expect(job.User).toHaveProperty('name')
        expect(job.User).toHaveProperty('email')
      }
    })
  })
})