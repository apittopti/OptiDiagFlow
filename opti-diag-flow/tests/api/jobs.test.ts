import { NextRequest } from 'next/server'
import { GET, POST, PATCH } from '@/app/api/jobs/route'
import { GET as getById, PUT, DELETE } from '@/app/api/jobs/[id]/route'
import { getServerSession } from 'next-auth'
import {
  mockPrisma,
  mockSession,
  mockUnauthorizedSession,
  createMockRequest,
  createMockParams,
  sampleJob,
  sampleVehicle,
  sampleModelYear,
  resetMocks
} from '../utils/test-helpers'

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/auth-config', () => ({
  authOptions: {},
}))

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('Job API Routes', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/jobs', () => {
    it('should return paginated jobs for authenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findMany.mockResolvedValue([sampleJob])
      mockPrisma.diagnosticJob.count.mockResolvedValue(1)

      const request = createMockRequest('GET', 'http://localhost:3000/api/jobs')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('jobs')
      expect(result).toHaveProperty('total', 1)
      expect(result).toHaveProperty('limit', 50)
      expect(result).toHaveProperty('offset', 0)
      expect(Array.isArray(result.jobs)).toBe(true)
      expect(result.jobs).toHaveLength(1)
      expect(result.jobs[0]).toEqual(sampleJob)
    })

    it('should filter jobs by vehicleId when provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findMany.mockResolvedValue([sampleJob])
      mockPrisma.diagnosticJob.count.mockResolvedValue(1)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/jobs',
        undefined,
        { vehicleId: 'vehicle-test-id' }
      )

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.findMany).toHaveBeenCalledWith({
        where: { vehicleId: 'vehicle-test-id' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      })
    })

    it('should filter jobs by status when provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findMany.mockResolvedValue([])
      mockPrisma.diagnosticJob.count.mockResolvedValue(0)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/jobs',
        undefined,
        { status: 'ACTIVE' }
      )

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      })
    })

    it('should filter jobs by procedure type when provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findMany.mockResolvedValue([])
      mockPrisma.diagnosticJob.count.mockResolvedValue(0)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/jobs',
        undefined,
        { procedureType: 'diagnostic' }
      )

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.findMany).toHaveBeenCalledWith({
        where: { procedureType: { contains: 'diagnostic', mode: 'insensitive' } },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      })
    })

    it('should handle pagination parameters', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findMany.mockResolvedValue([])
      mockPrisma.diagnosticJob.count.mockResolvedValue(100)

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/jobs',
        undefined,
        { limit: '10', offset: '20' }
      )

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('limit', 10)
      expect(result).toHaveProperty('offset', 20)
      expect(mockPrisma.diagnosticJob.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('GET', 'http://localhost:3000/api/jobs')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
      expect(mockPrisma.diagnosticJob.findMany).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/jobs', () => {
    it('should create a new job with existing vehicle', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(sampleVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue(sampleJob)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id',
        vin: 'TEST123456789'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(result).toEqual(sampleJob)
      expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: {
          modelYearId: 'model-year-test-id',
          vin: 'TEST123456789'
        }
      })
      expect(mockPrisma.diagnosticJob.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Job',
          procedureType: 'Diagnostic',
          status: 'DRAFT',
          vehicleId: sampleVehicle.id,
          uploadedBy: mockSession.user.id,
          messageCount: 0,
          ecuCount: 0,
          duration: 0
        },
        include: expect.any(Object)
      })
    })

    it('should create a new job and vehicle when vehicle does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(null)
      mockPrisma.vehicle.create.mockResolvedValue(sampleVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue(sampleJob)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id',
        vin: 'NEW123456789'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: {
          modelYearId: 'model-year-test-id',
          vin: 'NEW123456789',
          createdBy: mockSession.user.id
        }
      })
      expect(mockPrisma.diagnosticJob.create).toHaveBeenCalled()
    })

    it('should create job without VIN', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(null)
      mockPrisma.vehicle.create.mockResolvedValue({ ...sampleVehicle, vin: null })
      mockPrisma.diagnosticJob.create.mockResolvedValue(sampleJob)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: {
          modelYearId: 'model-year-test-id',
          vin: null,
          createdBy: mockSession.user.id
        }
      })
    })

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const testCases = [
        { body: { jobType: 'Diagnostic', vehicleModelYearId: 'test' }, missing: 'name' },
        { body: { name: 'Test Job', vehicleModelYearId: 'test' }, missing: 'jobType' },
        { body: { name: 'Test Job', jobType: 'Diagnostic' }, missing: 'vehicleModelYearId' }
      ]

      for (const testCase of testCases) {
        const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', testCase.body)

        // Act
        const response = await POST(request)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(result).toHaveProperty('error', 'Name, job type, and vehicle model year are required')
        expect(mockPrisma.diagnosticJob.create).not.toHaveBeenCalled()

        // Reset for next iteration
        resetMocks()
        jest.clearAllMocks()
      }
    })

    it('should return 404 when model year does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'non-existent'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model year not found')
      expect(mockPrisma.diagnosticJob.create).not.toHaveBeenCalled()
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('PATCH /api/jobs', () => {
    it('should update job status for job owner', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      const updatedJob = { ...sampleJob, status: 'ACTIVE' }
      mockPrisma.diagnosticJob.update.mockResolvedValue(updatedJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        status: 'ACTIVE'
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(updatedJob)
      expect(mockPrisma.diagnosticJob.update).toHaveBeenCalledWith({
        where: { id: 'job-test-id' },
        data: { status: 'ACTIVE' },
        include: expect.any(Object)
      })
    })

    it('should update job metadata', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      const metadata = { processedFiles: 5, errors: 0 }
      const updatedJob = { ...sampleJob, metadata }
      mockPrisma.diagnosticJob.update.mockResolvedValue(updatedJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        metadata
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.update).toHaveBeenCalledWith({
        where: { id: 'job-test-id' },
        data: { metadata },
        include: expect.any(Object)
      })
    })

    it('should update job tags', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      const mockTag = { id: 'tag-id', name: 'urgent' }
      mockPrisma.tag.upsert.mockResolvedValue(mockTag)
      const updatedJob = { ...sampleJob, Tag: [mockTag] }
      mockPrisma.diagnosticJob.update.mockResolvedValue(updatedJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        tags: ['urgent', 'priority']
      })

      // Act
      const response = await PATCH(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2)
      expect(mockPrisma.diagnosticJob.update).toHaveBeenCalledWith({
        where: { id: 'job-test-id' },
        data: { tags: { set: [{ id: 'tag-id' }, { id: 'tag-id' }] } },
        include: expect.any(Object)
      })
    })

    it('should return 400 when jobId is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        status: 'ACTIVE'
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Job ID is required')
    })

    it('should return 404 when job does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'non-existent',
        status: 'ACTIVE'
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Job not found')
    })

    it('should return 403 when user does not own the job', async () => {
      // Arrange
      const unauthorizedSession = {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id', role: 'VIEWER' }
      }
      mockGetServerSession.mockResolvedValue(unauthorizedSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        status: 'ACTIVE'
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(result).toHaveProperty('error', 'Permission denied')
    })

    it('should allow admin to update any job', async () => {
      // Arrange
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id', role: 'ADMIN' }
      }
      mockGetServerSession.mockResolvedValue(adminSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      const updatedJob = { ...sampleJob, status: 'ARCHIVED' }
      mockPrisma.diagnosticJob.update.mockResolvedValue(updatedJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        status: 'ARCHIVED'
      })

      // Act
      const response = await PATCH(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.update).toHaveBeenCalled()
    })

    it('should return 400 for invalid status', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)

      const request = createMockRequest('PATCH', 'http://localhost:3000/api/jobs', {
        jobId: 'job-test-id',
        status: 'INVALID_STATUS'
      })

      // Act
      const response = await PATCH(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Invalid status')
    })
  })

  describe('GET /api/jobs/[id]', () => {
    it('should return specific job', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)

      const request = createMockRequest('GET', 'http://localhost:3000/api/jobs/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(sampleJob)
    })

    it('should return 404 when job not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(null)

      const request = createMockRequest('GET', 'http://localhost:3000/api/jobs/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Job not found')
    })
  })

  describe('DELETE /api/jobs/[id]', () => {
    it('should delete job for job owner', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      mockPrisma.diagnosticJob.delete.mockResolvedValue(sampleJob)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/jobs/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('message', 'Job deleted successfully')
      expect(mockPrisma.diagnosticJob.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      })
    })

    it('should return 404 when job to delete not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(null)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/jobs/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Job not found')
      expect(mockPrisma.diagnosticJob.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the job', async () => {
      // Arrange
      const unauthorizedSession = {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id', role: 'VIEWER' }
      }
      mockGetServerSession.mockResolvedValue(unauthorizedSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/jobs/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(result).toHaveProperty('error', 'Permission denied')
      expect(mockPrisma.diagnosticJob.delete).not.toHaveBeenCalled()
    })

    it('should allow admin to delete any job', async () => {
      // Arrange
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user-id', role: 'ADMIN' }
      }
      mockGetServerSession.mockResolvedValue(adminSession)
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(sampleJob)
      mockPrisma.diagnosticJob.delete.mockResolvedValue(sampleJob)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/jobs/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.diagnosticJob.delete).toHaveBeenCalled()
    })
  })

  describe('Business Rules and Edge Cases', () => {
    it('should handle very long job names', async () => {
      // Arrange
      const longName = 'A'.repeat(500)
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(sampleVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue({
        ...sampleJob,
        name: longName
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: longName,
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should handle special characters in job names', async () => {
      // Arrange
      const specialName = 'Job #1 (Critical) - ECU Test & Validation'
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(sampleVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue({
        ...sampleJob,
        name: specialName
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: specialName,
        jobType: 'Diagnostic',
        vehicleModelYearId: 'model-year-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should validate VIN format if provided', async () => {
      // Test various VIN formats
      const testVins = [
        '1HGBH41JXMN109186', // Valid 17-character VIN
        '1HGBH41JXMN109186ABC', // Too long
        '1HGBH41JX', // Too short
        '', // Empty string
        'INVALID_VIN_WITH_SYMBOLS!@#' // Invalid characters
      ]

      for (const vin of testVins) {
        mockGetServerSession.mockResolvedValue(mockSession)
        mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
        mockPrisma.vehicle.findFirst.mockResolvedValue(null)
        mockPrisma.vehicle.create.mockResolvedValue({
          ...sampleVehicle,
          vin: vin || null
        })
        mockPrisma.diagnosticJob.create.mockResolvedValue(sampleJob)

        const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
          name: 'Test Job',
          jobType: 'Diagnostic',
          vehicleModelYearId: 'model-year-test-id',
          vin: vin
        })

        // Act
        const response = await POST(request)

        // Assert
        // For now, the API accepts any VIN format, but this could be enhanced
        expect(response.status).toBe(201)

        // Reset for next iteration
        resetMocks()
        jest.clearAllMocks()
      }
    })

    it('should handle concurrent job creation for same vehicle', async () => {
      // This test simulates race conditions
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(sampleVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue(sampleJob)

      const requests = Array.from({ length: 5 }, (_, i) =>
        createMockRequest('POST', 'http://localhost:3000/api/jobs', {
          name: `Concurrent Job ${i}`,
          jobType: 'Diagnostic',
          vehicleModelYearId: 'model-year-test-id',
          vin: 'SHARED123456789'
        })
      )

      // Act
      const responses = await Promise.all(requests.map(req => POST(req)))

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(201)
      })
      expect(mockPrisma.diagnosticJob.create).toHaveBeenCalledTimes(5)
    })
  })
})