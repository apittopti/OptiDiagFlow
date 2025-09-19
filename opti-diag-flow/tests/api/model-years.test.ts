import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/model-years/route'
import { GET as getById, PUT, DELETE } from '@/app/api/model-years/[id]/route'
import { getServerSession } from 'next-auth'
import {
  mockPrisma,
  mockSession,
  mockUnauthorizedSession,
  createMockRequest,
  createMockParams,
  sampleModel,
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

describe('ModelYear API Routes', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
  })

  describe('GET /api/model-years', () => {
    it('should return all model years for authenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findMany.mockResolvedValue([sampleModelYear])

      const request = createMockRequest('GET', 'http://localhost:3000/api/model-years')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(sampleModelYear)
      expect(mockPrisma.modelYear.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          Model: {
            include: {
              OEM: {
                select: {
                  id: true,
                  name: true,
                  shortName: true
                }
              }
            }
          },
          Vehicle: {
            select: {
              _count: {
                select: {
                  DiagnosticJob: true
                }
              }
            }
          }
        },
        orderBy: [
          { Model: { OEM: { name: 'asc' } } },
          { Model: { name: 'asc' } },
          { year: 'desc' }
        ]
      })
    })

    it('should filter model years by model ID when provided', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findMany.mockResolvedValue([sampleModelYear])

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/model-years',
        undefined,
        { modelId: 'model-test-id' }
      )

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrisma.modelYear.findMany).toHaveBeenCalledWith({
        where: { modelId: 'model-test-id' },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('GET', 'http://localhost:3000/api/model-years')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
      expect(mockPrisma.modelYear.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findMany.mockRejectedValue(new Error('Database error'))

      const request = createMockRequest('GET', 'http://localhost:3000/api/model-years')

      // Act
      const response = await GET(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(result).toHaveProperty('error', 'Failed to fetch model years')
    })
  })

  describe('POST /api/model-years', () => {
    it('should create a new model year with valid data', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null) // No duplicate
      mockPrisma.modelYear.create.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(result).toEqual(sampleModelYear)
      expect(mockPrisma.modelYear.create).toHaveBeenCalledWith({
        data: {
          year: 2023,
          modelId: 'model-test-id'
        },
        include: {
          Model: {
            include: {
              OEM: {
                select: {
                  id: true,
                  name: true,
                  shortName: true
                }
              }
            }
          },
          Vehicle: {
            select: {
              _count: {
                select: {
                  DiagnosticJob: true
                }
              }
            }
          }
        }
      })
    })

    it('should return 400 when year is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Year and Model ID are required')
      expect(mockPrisma.modelYear.create).not.toHaveBeenCalled()
    })

    it('should return 400 when modelId is missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Year and Model ID are required')
    })

    it('should return 400 for invalid year range (too old)', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 1899,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Invalid year range')
      expect(mockPrisma.modelYear.create).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid year range (too future)', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      const futureYear = new Date().getFullYear() + 3

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: futureYear,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Invalid year range')
    })

    it('should allow current year', async () => {
      // Arrange
      const currentYear = new Date().getFullYear()
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null)
      mockPrisma.modelYear.create.mockResolvedValue({
        ...sampleModelYear,
        year: currentYear
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: currentYear,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should allow next year', async () => {
      // Arrange
      const nextYear = new Date().getFullYear() + 1
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null)
      mockPrisma.modelYear.create.mockResolvedValue({
        ...sampleModelYear,
        year: nextYear
      })

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: nextYear,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should return 404 when model does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'non-existent-model'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
      expect(mockPrisma.modelYear.create).not.toHaveBeenCalled()
    })

    it('should return 409 when model year already exists for same model', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'This year already exists for this model')
      expect(mockPrisma.modelYear.create).not.toHaveBeenCalled()
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockUnauthorizedSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(result).toHaveProperty('error', 'Unauthorized')
    })
  })

  describe('GET /api/model-years/[id]', () => {
    it('should return specific model year', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('GET', 'http://localhost:3000/api/model-years/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(sampleModelYear)
      expect(mockPrisma.modelYear.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        include: {
          Model: {
            include: {
              OEM: {
                select: {
                  id: true,
                  name: true,
                  shortName: true
                }
              }
            }
          },
          Vehicle: {
            select: {
              _count: {
                select: {
                  DiagnosticJob: true
                }
              }
            }
          }
        }
      })
    })

    it('should return 404 when model year not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(null)

      const request = createMockRequest('GET', 'http://localhost:3000/api/model-years/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await getById(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model year not found')
    })
  })

  describe('PUT /api/model-years/[id]', () => {
    it('should update existing model year', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null) // No duplicate
      const updatedModelYear = {
        ...sampleModelYear,
        year: 2024
      }
      mockPrisma.modelYear.update.mockResolvedValue(updatedModelYear)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/test-id', {
        year: 2024,
        modelId: 'model-test-id'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toEqual(updatedModelYear)
      expect(mockPrisma.modelYear.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: {
          year: 2024,
          modelId: 'model-test-id'
        },
        include: {
          Model: {
            include: {
              OEM: {
                select: {
                  id: true,
                  name: true,
                  shortName: true
                }
              }
            }
          },
          Vehicle: {
            select: {
              _count: {
                select: {
                  DiagnosticJob: true
                }
              }
            }
          }
        }
      })
    })

    it('should return 404 when model year to update not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/non-existent', {
        year: 2024,
        modelId: 'model-test-id'
      })
      const params = createMockParams('non-existent')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model year not found')
      expect(mockPrisma.modelYear.update).not.toHaveBeenCalled()
    })

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/test-id', {
        modelId: 'model-test-id'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Year and Model ID are required')
    })

    it('should return 400 for invalid year range in update', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/test-id', {
        year: 1800,
        modelId: 'model-test-id'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(result).toHaveProperty('error', 'Invalid year range')
    })

    it('should return 404 when new model does not exist', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/test-id', {
        year: 2024,
        modelId: 'non-existent-model'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
    })

    it('should return 409 when updating to duplicate year within same model', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(sampleModelYear)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue({
        ...sampleModelYear,
        id: 'different-id',
        year: 2024
      })

      const request = createMockRequest('PUT', 'http://localhost:3000/api/model-years/test-id', {
        year: 2024,
        modelId: 'model-test-id'
      })
      const params = createMockParams('test-id')

      // Act
      const response = await PUT(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'This year already exists for this model')
    })
  })

  describe('DELETE /api/model-years/[id]', () => {
    it('should delete model year with no related vehicles', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue({
        ...sampleModelYear,
        _count: { Vehicle: 0 }
      })
      mockPrisma.modelYear.delete.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('message', 'Model year deleted successfully')
      expect(mockPrisma.modelYear.delete).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      })
    })

    it('should return 409 when model year has related vehicles', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue({
        ...sampleModelYear,
        _count: { Vehicle: 2 }
      })

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/test-id')
      const params = createMockParams('test-id')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete model year with existing vehicles. Delete all vehicles first.')
      expect(mockPrisma.modelYear.delete).not.toHaveBeenCalled()
    })

    it('should return 404 when model year to delete not found', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.modelYear.findUnique.mockResolvedValue(null)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/non-existent')
      const params = createMockParams('non-existent')

      // Act
      const response = await DELETE(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model year not found')
      expect(mockPrisma.modelYear.delete).not.toHaveBeenCalled()
    })
  })

  describe('Business Rules and Edge Cases', () => {
    it('should allow same year for different models', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null) // No duplicate within same model
      mockPrisma.modelYear.create.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'different-model-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockPrisma.modelYear.findFirst).toHaveBeenCalledWith({
        where: {
          year: 2023,
          modelId: 'different-model-id'
        }
      })
    })

    it('should handle year boundaries correctly', async () => {
      // Test cases for year validation boundaries
      const testCases = [
        { year: 1900, shouldPass: true, description: 'minimum valid year' },
        { year: 1899, shouldPass: false, description: 'below minimum year' },
        { year: new Date().getFullYear() + 2, shouldPass: true, description: 'maximum valid year' },
        { year: new Date().getFullYear() + 3, shouldPass: false, description: 'above maximum year' }
      ]

      for (const testCase of testCases) {
        // Arrange
        mockGetServerSession.mockResolvedValue(mockSession)
        if (testCase.shouldPass) {
          mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
          mockPrisma.modelYear.findFirst.mockResolvedValue(null)
          mockPrisma.modelYear.create.mockResolvedValue({
            ...sampleModelYear,
            year: testCase.year
          })
        }

        const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
          year: testCase.year,
          modelId: 'model-test-id'
        })

        // Act
        const response = await POST(request)

        // Assert
        if (testCase.shouldPass) {
          expect(response.status).toBe(201)
        } else {
          expect(response.status).toBe(400)
          const result = await response.json()
          expect(result).toHaveProperty('error', 'Invalid year range')
        }

        // Reset for next iteration
        resetMocks()
        jest.clearAllMocks()
      }
    })

    it('should handle non-integer years', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023.5,
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert - JavaScript will handle this as integer, so it should pass validation
      // but we should ensure the validation logic is robust
      expect(response.status).toBe(400) // assuming validation should catch this
    })

    it('should handle string years that can be parsed to numbers', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)
      mockPrisma.model.findUnique.mockResolvedValue(sampleModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null)
      mockPrisma.modelYear.create.mockResolvedValue(sampleModelYear)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: '2023',
        modelId: 'model-test-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should handle invalid year formats', async () => {
      // Arrange
      mockGetServerSession.mockResolvedValue(mockSession)

      const invalidYears = ['invalid', null, undefined, NaN, 'twenty-twenty-three']

      for (const invalidYear of invalidYears) {
        const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
          year: invalidYear,
          modelId: 'model-test-id'
        })

        // Act
        const response = await POST(request)
        const result = await response.json()

        // Assert
        expect(response.status).toBe(400)
        expect(result).toHaveProperty('error')

        // Reset for next iteration
        resetMocks()
        jest.clearAllMocks()
      }
    })
  })
})