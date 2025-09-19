import { NextRequest } from 'next/server'
import { GET as getOEMs, POST as createOEM } from '@/app/api/oems/route'
import { DELETE as deleteOEM } from '@/app/api/oems/[id]/route'
import { GET as getModels, POST as createModel } from '@/app/api/models/route'
import { DELETE as deleteModel } from '@/app/api/models/[id]/route'
import { GET as getModelYears, POST as createModelYear } from '@/app/api/model-years/route'
import { DELETE as deleteModelYear } from '@/app/api/model-years/[id]/route'
import { GET as getJobs, POST as createJob } from '@/app/api/jobs/route'
import { DELETE as deleteJob } from '@/app/api/jobs/[id]/route'
import { getServerSession } from 'next-auth'
import {
  mockPrisma,
  mockSession,
  createMockRequest,
  createMockParams,
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

describe('Cascading Operations Integration Tests', () => {
  beforeEach(() => {
    resetMocks()
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue(mockSession)
  })

  describe('OEM -> Model -> ModelYear -> Job Hierarchy', () => {
    it('should prevent deleting OEM with existing models', async () => {
      // Arrange
      const oemWithModels = {
        id: 'oem-with-models',
        name: 'Test OEM',
        shortName: 'TO',
        _count: { Model: 2 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(oemWithModels)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/oem-with-models')
      const params = createMockParams('oem-with-models')

      // Act
      const response = await deleteOEM(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete OEM with existing models. Delete all models first.')
      expect(mockPrisma.oEM.delete).not.toHaveBeenCalled()
    })

    it('should allow deleting OEM with no models', async () => {
      // Arrange
      const oemWithoutModels = {
        id: 'oem-without-models',
        name: 'Empty OEM',
        shortName: 'EO',
        _count: { Model: 0 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(oemWithoutModels)
      mockPrisma.oEM.delete.mockResolvedValue(oemWithoutModels)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/oem-without-models')
      const params = createMockParams('oem-without-models')

      // Act
      const response = await deleteOEM(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(result).toHaveProperty('message', 'OEM deleted successfully')
      expect(mockPrisma.oEM.delete).toHaveBeenCalledWith({
        where: { id: 'oem-without-models' }
      })
    })

    it('should prevent deleting model with existing model years', async () => {
      // Arrange
      const modelWithYears = {
        id: 'model-with-years',
        name: 'Test Model',
        oemId: 'test-oem',
        _count: { ModelYear: 3 }
      }
      mockPrisma.model.findUnique.mockResolvedValue(modelWithYears)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/models/model-with-years')
      const params = createMockParams('model-with-years')

      // Act
      const response = await deleteModel(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete model with existing years. Delete all years first.')
      expect(mockPrisma.model.delete).not.toHaveBeenCalled()
    })

    it('should prevent deleting model year with existing vehicles', async () => {
      // Arrange
      const modelYearWithVehicles = {
        id: 'model-year-with-vehicles',
        modelId: 'test-model',
        year: 2023,
        _count: { Vehicle: 1 }
      }
      mockPrisma.modelYear.findUnique.mockResolvedValue(modelYearWithVehicles)

      const request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/model-year-with-vehicles')
      const params = createMockParams('model-year-with-vehicles')

      // Act
      const response = await deleteModelYear(request, { params })
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Cannot delete model year with existing vehicles. Delete all vehicles first.')
      expect(mockPrisma.modelYear.delete).not.toHaveBeenCalled()
    })
  })

  describe('Complete Hierarchy Deletion Workflow', () => {
    it('should require deletion in correct order: Jobs -> Vehicles -> ModelYears -> Models -> OEMs', async () => {
      // This test simulates the proper deletion order

      // Step 1: Try to delete OEM (should fail)
      const oemWithHierarchy = {
        id: 'oem-hierarchy',
        name: 'Hierarchy OEM',
        shortName: 'HO',
        _count: { Model: 1 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(oemWithHierarchy)

      let request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/oem-hierarchy')
      let params = createMockParams('oem-hierarchy')
      let response = await deleteOEM(request, { params })

      expect(response.status).toBe(409)

      // Step 2: Try to delete Model (should fail)
      const modelWithHierarchy = {
        id: 'model-hierarchy',
        name: 'Hierarchy Model',
        oemId: 'oem-hierarchy',
        _count: { ModelYear: 1 }
      }
      mockPrisma.model.findUnique.mockResolvedValue(modelWithHierarchy)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/models/model-hierarchy')
      params = createMockParams('model-hierarchy')
      response = await deleteModel(request, { params })

      expect(response.status).toBe(409)

      // Step 3: Try to delete ModelYear (should fail due to vehicles)
      const modelYearWithHierarchy = {
        id: 'model-year-hierarchy',
        modelId: 'model-hierarchy',
        year: 2023,
        _count: { Vehicle: 1 }
      }
      mockPrisma.modelYear.findUnique.mockResolvedValue(modelYearWithHierarchy)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/model-year-hierarchy')
      params = createMockParams('model-year-hierarchy')
      response = await deleteModelYear(request, { params })

      expect(response.status).toBe(409)

      // Step 4: Delete Job first (should succeed)
      const jobInHierarchy = {
        id: 'job-hierarchy',
        name: 'Hierarchy Job',
        vehicleId: 'vehicle-hierarchy',
        uploadedBy: mockSession.user.id,
        status: 'ACTIVE',
        procedureType: 'Diagnostic'
      }
      mockPrisma.diagnosticJob.findUnique.mockResolvedValue(jobInHierarchy)
      mockPrisma.diagnosticJob.delete.mockResolvedValue(jobInHierarchy)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/jobs/job-hierarchy')
      params = createMockParams('job-hierarchy')
      response = await deleteJob(request, { params })

      expect(response.status).toBe(200)

      // Step 5: Now ModelYear can be deleted (assuming vehicles are removed)
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const emptyModelYear = {
        ...modelYearWithHierarchy,
        _count: { Vehicle: 0 }
      }
      mockPrisma.modelYear.findUnique.mockResolvedValue(emptyModelYear)
      mockPrisma.modelYear.delete.mockResolvedValue(emptyModelYear)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/model-years/model-year-hierarchy')
      params = createMockParams('model-year-hierarchy')
      response = await deleteModelYear(request, { params })

      expect(response.status).toBe(200)

      // Step 6: Now Model can be deleted
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const emptyModel = {
        ...modelWithHierarchy,
        _count: { ModelYear: 0 }
      }
      mockPrisma.model.findUnique.mockResolvedValue(emptyModel)
      mockPrisma.model.delete.mockResolvedValue(emptyModel)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/models/model-hierarchy')
      params = createMockParams('model-hierarchy')
      response = await deleteModel(request, { params })

      expect(response.status).toBe(200)

      // Step 7: Finally OEM can be deleted
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const emptyOEM = {
        ...oemWithHierarchy,
        _count: { Model: 0 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(emptyOEM)
      mockPrisma.oEM.delete.mockResolvedValue(emptyOEM)

      request = createMockRequest('DELETE', 'http://localhost:3000/api/oems/oem-hierarchy')
      params = createMockParams('oem-hierarchy')
      response = await deleteOEM(request, { params })

      expect(response.status).toBe(200)
    })
  })

  describe('Creation Dependencies', () => {
    it('should require valid OEM to create model', async () => {
      // Arrange
      mockPrisma.oEM.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Test Model',
        oemId: 'non-existent-oem'
      })

      // Act
      const response = await createModel(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'OEM not found')
      expect(mockPrisma.model.create).not.toHaveBeenCalled()
    })

    it('should require valid model to create model year', async () => {
      // Arrange
      mockPrisma.model.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'non-existent-model'
      })

      // Act
      const response = await createModelYear(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model not found')
      expect(mockPrisma.modelYear.create).not.toHaveBeenCalled()
    })

    it('should require valid model year to create job', async () => {
      // Arrange
      mockPrisma.modelYear.findUnique.mockResolvedValue(null)

      const request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Test Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'non-existent-model-year'
      })

      // Act
      const response = await createJob(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(result).toHaveProperty('error', 'Model year not found')
      expect(mockPrisma.diagnosticJob.create).not.toHaveBeenCalled()
    })
  })

  describe('Duplicate Prevention Across Hierarchy', () => {
    it('should prevent duplicate OEM names', async () => {
      // Arrange
      const existingOEM = {
        id: 'existing-oem',
        name: 'Existing OEM',
        shortName: 'EO'
      }
      mockPrisma.oEM.findFirst.mockResolvedValue(existingOEM)

      const request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Existing OEM',
        shortName: 'NEW'
      })

      // Act
      const response = await createOEM(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'OEM with this name or short name already exists')
    })

    it('should prevent duplicate model names within same OEM', async () => {
      // Arrange
      const validOEM = { id: 'valid-oem', name: 'Valid OEM', shortName: 'VO' }
      const existingModel = {
        id: 'existing-model',
        name: 'Existing Model',
        oemId: 'valid-oem'
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(validOEM)
      mockPrisma.model.findFirst.mockResolvedValue(existingModel)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Existing Model',
        oemId: 'valid-oem'
      })

      // Act
      const response = await createModel(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'Model with this name already exists for this OEM')
    })

    it('should allow same model name for different OEMs', async () => {
      // Arrange
      const validOEM = { id: 'different-oem', name: 'Different OEM', shortName: 'DO' }
      const newModel = {
        id: 'new-model',
        name: 'Common Model Name',
        oemId: 'different-oem',
        OEM: validOEM,
        _count: { ModelYear: 0 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(validOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null) // No duplicate within this OEM
      mockPrisma.model.create.mockResolvedValue(newModel)

      const request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Common Model Name',
        oemId: 'different-oem'
      })

      // Act
      const response = await createModel(request)

      // Assert
      expect(response.status).toBe(201)
    })

    it('should prevent duplicate years within same model', async () => {
      // Arrange
      const validModel = { id: 'valid-model', name: 'Valid Model', oemId: 'valid-oem' }
      const existingModelYear = {
        id: 'existing-year',
        year: 2023,
        modelId: 'valid-model'
      }
      mockPrisma.model.findUnique.mockResolvedValue(validModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(existingModelYear)

      const request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'valid-model'
      })

      // Act
      const response = await createModelYear(request)
      const result = await response.json()

      // Assert
      expect(response.status).toBe(409)
      expect(result).toHaveProperty('error', 'This year already exists for this model')
    })
  })

  describe('Data Integrity Across Operations', () => {
    it('should maintain referential integrity when creating full hierarchy', async () => {
      // Create a complete hierarchy from OEM to Job

      // Step 1: Create OEM
      const newOEM = {
        id: 'integrity-oem',
        name: 'Integrity OEM',
        shortName: 'IO',
        _count: { Model: 0 }
      }
      mockPrisma.oEM.findFirst.mockResolvedValue(null)
      mockPrisma.oEM.create.mockResolvedValue(newOEM)

      let request = createMockRequest('POST', 'http://localhost:3000/api/oems', {
        name: 'Integrity OEM',
        shortName: 'IO'
      })
      let response = await createOEM(request)

      expect(response.status).toBe(201)

      // Step 2: Create Model
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const newModel = {
        id: 'integrity-model',
        name: 'Integrity Model',
        oemId: 'integrity-oem',
        OEM: newOEM,
        _count: { ModelYear: 0 }
      }
      mockPrisma.oEM.findUnique.mockResolvedValue(newOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)
      mockPrisma.model.create.mockResolvedValue(newModel)

      request = createMockRequest('POST', 'http://localhost:3000/api/models', {
        name: 'Integrity Model',
        oemId: 'integrity-oem'
      })
      response = await createModel(request)

      expect(response.status).toBe(201)

      // Step 3: Create ModelYear
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const newModelYear = {
        id: 'integrity-model-year',
        modelId: 'integrity-model',
        year: 2023,
        Model: newModel,
        Vehicle: []
      }
      mockPrisma.model.findUnique.mockResolvedValue(newModel)
      mockPrisma.modelYear.findFirst.mockResolvedValue(null)
      mockPrisma.modelYear.create.mockResolvedValue(newModelYear)

      request = createMockRequest('POST', 'http://localhost:3000/api/model-years', {
        year: 2023,
        modelId: 'integrity-model'
      })
      response = await createModelYear(request)

      expect(response.status).toBe(201)

      // Step 4: Create Job (which creates vehicle)
      resetMocks()
      mockGetServerSession.mockResolvedValue(mockSession)
      const newVehicle = {
        id: 'integrity-vehicle',
        modelYearId: 'integrity-model-year',
        vin: 'INTEGRITY123456789',
        createdBy: mockSession.user.id
      }
      const newJob = {
        id: 'integrity-job',
        name: 'Integrity Job',
        vehicleId: 'integrity-vehicle',
        uploadedBy: mockSession.user.id,
        status: 'DRAFT',
        procedureType: 'Diagnostic',
        Vehicle: newVehicle,
        User: mockSession.user,
        Tag: []
      }

      mockPrisma.modelYear.findUnique.mockResolvedValue(newModelYear)
      mockPrisma.vehicle.findFirst.mockResolvedValue(null)
      mockPrisma.vehicle.create.mockResolvedValue(newVehicle)
      mockPrisma.diagnosticJob.create.mockResolvedValue(newJob)

      request = createMockRequest('POST', 'http://localhost:3000/api/jobs', {
        name: 'Integrity Job',
        jobType: 'Diagnostic',
        vehicleModelYearId: 'integrity-model-year',
        vin: 'INTEGRITY123456789'
      })
      response = await createJob(request)

      expect(response.status).toBe(201)

      // Verify all creation calls were made with correct references
      expect(mockPrisma.oEM.create).toHaveBeenCalledWith({
        data: {
          name: 'Integrity OEM',
          shortName: 'IO'
        },
        include: expect.any(Object)
      })

      expect(mockPrisma.model.create).toHaveBeenCalledWith({
        data: {
          name: 'Integrity Model',
          oemId: 'integrity-oem',
          platform: undefined
        },
        include: expect.any(Object)
      })

      expect(mockPrisma.modelYear.create).toHaveBeenCalledWith({
        data: {
          year: 2023,
          modelId: 'integrity-model'
        },
        include: expect.any(Object)
      })

      expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
        data: {
          modelYearId: 'integrity-model-year',
          vin: 'INTEGRITY123456789',
          createdBy: mockSession.user.id
        }
      })

      expect(mockPrisma.diagnosticJob.create).toHaveBeenCalledWith({
        data: {
          name: 'Integrity Job',
          procedureType: 'Diagnostic',
          status: 'DRAFT',
          vehicleId: 'integrity-vehicle',
          uploadedBy: mockSession.user.id,
          messageCount: 0,
          ecuCount: 0,
          duration: 0
        },
        include: expect.any(Object)
      })
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent creation of similar entities', async () => {
      // Test concurrent creation of models for same OEM
      const validOEM = { id: 'concurrent-oem', name: 'Concurrent OEM', shortName: 'CO' }

      mockPrisma.oEM.findUnique.mockResolvedValue(validOEM)
      mockPrisma.model.findFirst.mockResolvedValue(null)

      // Create multiple models concurrently
      const modelCreationPromises = Array.from({ length: 3 }, (_, i) => {
        const model = {
          id: `concurrent-model-${i}`,
          name: `Concurrent Model ${i}`,
          oemId: 'concurrent-oem',
          OEM: validOEM,
          _count: { ModelYear: 0 }
        }
        mockPrisma.model.create.mockResolvedValueOnce(model)

        return createModel(createMockRequest('POST', 'http://localhost:3000/api/models', {
          name: `Concurrent Model ${i}`,
          oemId: 'concurrent-oem'
        }))
      })

      // Act
      const responses = await Promise.all(modelCreationPromises)

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(201)
      })
      expect(mockPrisma.model.create).toHaveBeenCalledTimes(3)
    })
  })
})