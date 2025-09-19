import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/models/route'
import { GET as getById, PUT, DELETE } from '@/app/api/models/[id]/route'
import { getServerSession } from 'next-auth'
import {
  mockPrisma,
  mockSession,
  mockUnauthorizedSession,
  createMockRequest,
  createMockParams,
  sampleOEM,
  sampleModel,
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

describe('Model API Routes', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/models', () => {
    it('should return all models for authenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findMany.mockResolvedValue([sampleModel])

      const request = createMockRequest('GET', 'http://localhost:3000/api/models')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(sampleModel)
      expect(mockPrisma.model.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          OEM: {
            select: {
              id: true,
              name: true,
              shortName: true
            }
          },
          _count: {
            select: {
              ModelYear: true
            }
          }
        },
        orderBy: [
          { OEM: { name: 'asc' } },
          { name: 'asc' }
        ]
      })
    })

    it('should filter models by OEM ID when provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findMany.mockResolvedValue([sampleModel])

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/models',
        undefined,
        { oemId: 'oem-test-id' }
      )

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.model.findMany).toHaveBeenCalledWith({
        where: { oemId: 'oem-test-id' },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('GET', 'http://localhost:3000/api/models')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
      expect(mockPrisma.model.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findMany.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET', 'http://localhost:3000/api/models')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(result).toHaveProperty('error', 'Failed to fetch models')
    })
  })

  describe('POST /api/models', () => {
    it('should create a new model with valid data', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.model.create.mockResolvedValue(sampleModel)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'oem-test-id',
        platform: 'Test Platform'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(result).toEqual(sampleModel)
      expect(mockPrisma.model.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Model',
          oemId: 'oem-test-id',
          platform: 'Test Platform'
        },
        include: {
          OEM: {
            select: {
              id: true,
              name: true,
              shortName: true
            }
          },
          _count: {
            select: {
              ModelYear: true
            }
          }
        }
      })
    })

    it('should create model without platform when not provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)
      mockPrisma.model.create.mockResolvedValue({
        ...sampleModel,
        platform: null
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.model.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Model',
          oemId: 'oem-test-id',
          platform: undefined
        },
        include: expect.any(Object)
      })
    })

    it('should return 400 when name is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Model name and OEM ID are required')
      expect(mockPrisma.model.create).not.toHaveBeenCalled()
    })

    it('should return 400 when oemId is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Model name and OEM ID are required')
    })

    it('should return 404 when OEM does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'non-existent-oem'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
      expect(mockPrisma.model.create).not.toHaveBeenCalled()
    })

    it('should return 409 when model with same name exists for same OEM', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(sampleModel)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Model with this name already exists for this OEM')
      expect(mockPrisma.model.create).not.toHaveBeenCalled()
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('GET /api/models/[id]', () => {
    it('should return specific model', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)

      const request = createMockRequest('GET', 'http://localhost:3000/api/models/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(sampleModel)
      expect(mockPrisma.model.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          OEM: {
            select: {
              id: true,
              name: true,
              shortName: true
            }
          },
          _count: {
            select: {
              ModelYear: true
            }
          }
        }
      })
    })

    it('should return 404 when model not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('GET', 'http://localhost:3000/api/models/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
    })
  })

  describe('PUT /api/models/[id]', () => {
    it('should update existing model', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null) // No duplicate
      const updatedModel = {
        ...sampleModel,
        name: 'Updated Model',
        platform: 'Updated Platform'
      }
      mockPrisma.model.update.mockResolvedValue(updatedModel)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/models/test-id', {
        name: 'Updated Model',
        oemId: 'oem-test-id',
        platform: 'Updated Platform'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(updatedModel)
      expect(mockPrisma.model.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          name: 'Updated Model',
          oemId: 'oem-test-id',
          platform: 'Updated Platform'
        },
        include: {
          OEM: {
            select: {
              id: true,
              name: true,
              shortName: true
            }
          },
          _count: {
            select: {
              ModelYear: true
            }
          }
        }
      })
    })

    it('should return 404 when model to update not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/models/non-existent', {
        name: 'Updated Model',
        oemId: 'oem-test-id'
      })
      const params = createMockParams('non-existent')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
      expect(mockPrisma.model.update).not.toHaveBeenCalled()
    })

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/models/test-id', {
        platform: 'Updated Platform'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Model name and OEM ID are required')
    })

    it('should return 404 when new OEM does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/models/test-id', {
        name: 'Updated Model',
        oemId: 'non-existent-oem'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
    })

    it('should return 409 when updating to duplicate name within same OEM', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue({
        ...sampleModel,
        id: 'different-id',
        name: 'Existing Model'
      })

      const request = createMockRequest('PUT', 'http://localhost:3000/api/models/test-id', {
        name: 'Existing Model',
        oemId: 'oem-test-id'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Model with this name already exists for this OEM')
    })
  })

  describe('DELETE /api/models/[id]', () => {
    it('should delete model with no related model years', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue({
        ...sampleModel,
        _count: { ModelYear: 0 }
      })
      mockPrisma.model.delete.mockResolvedValue(sampleModel)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/models/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('message', 'Model deleted successfully')
      expect(mockPrisma.model.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      })
    })

    it('should return 409 when model has related model years', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue({
        ...sampleModel,
        _count: { ModelYear: 2 }
      })

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/models/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete model with existing years. Delete all years first.')
      expect(mockPrisma.model.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when model to delete not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/models/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
      expect(mockPrisma.model.delete).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Business Rules', () => {
    it('should allow same model name for different OEMs', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null) // No duplicate within same OEM
      mockPrisma.model.create.mockResolvedValue(sampleModel)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Common Model Name',
        oemId: 'different-oem-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.model.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Common Model Name',
          oemId: 'different-oem-id'
        }
      })
    })

    it('should handle very long model names', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)
      mockPrisma.model.create.mockResolvedValue({
        ...sampleModel,
        name: longName
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: longName,
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should handle special characters in model names', async () => {
      // Arrange
      const specialName = 'Model X-5 (Turbo) / Hybrid Edition'
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)
      mockPrisma.model.create.mockResolvedValue({
        ...sampleModel,
        name: specialName
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: specialName,
        oemId: 'oem-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should validate platform field length and characters', async () => {
      // Arrange
      const longPlatform = 'Platform'.repeat(50)
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)
      mockPrisma.model.create.mockResolvedValue({
        ...sampleModel,
        platform: longPlatform
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'oem-test-id',
        platform: longPlatform
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })
  })
})