import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/oems/route'
import { GET as getById, PUT, DELETE } from '@/app/api/oems/[id]/route'
import { getServerSession } from 'next-auth'
import {
  mockPrisma,
  mockSession,
  mockUnauthorizedSession,
  createMockRequest,
  createMockParams,
  sampleOEM,
  resetMocks,
  validateResponseFormat,
  validateTimestamps
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

describe('OEM API Routes', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/oems', () => {
    it('should return all OEMs for authenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findMany.mockResolvedValue([sampleOEM])

      // Act
      const response = await GET()
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(sampleOEM)
      expect(mockPrisma.oEM.findMany).toHaveBeenCalledWith({
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      // Act
      const response = await GET()
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
      expect(mockPrisma.oEM.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findMany.mockRejectedValue(new Error('Database error'))

      // Act
      const response = await GET()
      const result = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(result).toHaveProperty('error', 'Failed to fetch OEMs')
    })
  })

  describe('POST /api/oems', () => {
    it('should create a new OEM with valid data', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.oEM.create.mockResolvedValue(sampleOEM)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Test OEM',
        shortName: 'TO'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(result).toEqual(sampleOEM)
      expect(mockPrisma.oEM.create).toHaveBeenCalledWith({
        data: {
          name: 'Test OEM',
          shortName: 'TO'
        },
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        }
      })
    })

    it('should create OEM with name as shortName when shortName not provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(null)
      mockPrisma.oEM.create.mockResolvedValue({
        ...sampleOEM,
        shortName: 'Test OEM'
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Test OEM'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.oEM.create).toHaveBeenCalledWith({
        data: {
          name: 'Test OEM',
          shortName: 'Test OEM'
        },
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        }
      })
    })

    it('should return 400 when name is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        shortName: 'TO'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'OEM name is required')
      expect(mockPrisma.oEM.create).not.toHaveBeenCalled()
    })

    it('should return 409 when OEM with same name exists', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(sampleOEM)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Test OEM',
        shortName: 'TO'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'OEM with this name or short name already exists')
      expect(mockPrisma.oEM.create).not.toHaveBeenCalled()
    })

    it('should return 409 when OEM with same shortName exists', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(sampleOEM)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Different OEM',
        shortName: 'TO'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'OEM with this name or short name already exists')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Test OEM'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('GET /api/oems/[id]', () => {
    it('should return specific OEM', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)

      const request = createMockRequest('GET', 'http://localhost:3000/api/oems/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(sampleOEM)
      expect(mockPrisma.oEM.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        }
      })
    })

    it('should return 404 when OEM not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('GET', 'http://localhost:3000/api/oems/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
    })
  })

  describe('PUT /api/oems/[id]', () => {
    it('should update existing OEM', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.oEM.findFirst.mockResolvedValue(null) // No duplicate
      const updatedOEM = { ...sampleOEM, name: 'Updated OEM', shortName: 'UO' }
      mockPrisma.oEM.update.mockResolvedValue(updatedOEM)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/oems/test-id', {
        name: 'Updated OEM',
        shortName: 'UO'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(updatedOEM)
      expect(mockPrisma.oEM.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          name: 'Updated OEM',
          shortName: 'UO'
        },
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        }
      })
    })

    it('should return 404 when OEM to update not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/oems/non-existent', {
        name: 'Updated OEM'
      })
      const params = createMockParams('non-existent')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
      expect(mockPrisma.oEM.update).not.toHaveBeenCalled()
    })

    it('should return 400 when name is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/oems/test-id', {
        shortName: 'UO'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'OEM name is required')
    })

    it('should return 409 when updating to duplicate name', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(sampleOEM)
      mockPrisma.oEM.findFirst.mockResolvedValue({
        ...sampleOEM,
        id: 'different-id',
        name: 'Existing OEM'
      })

      const request = createMockRequest('PUT', 'http://localhost:3000/api/oems/test-id', {
        name: 'Existing OEM'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'OEM with this name or short name already exists')
    })
  })

  describe('DELETE /api/oems/[id]', () => {
    it('should delete OEM with no related models', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue({
        ...sampleOEM,
        _count: { Model: 0 }
      })
      mockPrisma.oEM.delete.mockResolvedValue(sampleOEM)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('message', 'OEM deleted successfully')
      expect(mockPrisma.oEM.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      })
    })

    it('should return 409 when OEM has related models', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue({
        ...sampleOEM,
        _count: { Model: 3 }
      })

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete OEM with existing models. Delete all models first.')
      expect(mockPrisma.oEM.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when OEM to delete not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
      expect(mockPrisma.oEM.delete).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Performance', () => {
    it('should handle very long OEM names', async () => {
      // Arrange
      const longName = 'A'.repeat(255)
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(null)
      mockPrisma.oEM.create.mockResolvedValue({
        ...sampleOEM,
        name: longName,
        shortName: longName
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: longName
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.oEM.create).toHaveBeenCalled()
    })

    it('should handle special characters in OEM names', async () => {
      // Arrange
      const specialName = 'Björk & Co. (Ümlauts) - Special'
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.oEM.findFirst.mockResolvedValue(null)
      mockPrisma.oEM.create.mockResolvedValue({
        ...sampleOEM,
        name: specialName,
        shortName: 'BC'
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: specialName,
        shortName: 'BC'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should handle malformed JSON in request body', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = new NextRequest('http://localhost:3000/api/oems', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      })

      // Act & Assert
      await expect(POST(request)).rejects.toThrow()
    })
  })
})