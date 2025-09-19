import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { PrismaClient } from '@prisma/client'

/**
 * Database validation tests
 *
 * These tests validate database constraints, relationships,
 * and data integrity directly through Prisma.
 */

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:ClipperTippy1!@localhost:5432/postgres'
    }
  }
})

// Test user for data operations
const testUser = {
  id: 'db-test-user',
  email: 'dbtest@example.com',
  name: 'Database Test User',
  role: 'ADMIN' as const
}

describe('Database Validation Tests', () => {
  let testOEMId: string
  let testModelId: string
  let testModelYearId: string
  let testVehicleId: string

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData()

    // Create test user
    await prisma.user.upsert({
      where: { id: testUser.id },
      update: {},
      create: testUser
    })
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  async function cleanupTestData() {
    try {
      await prisma.diagnosticJob.deleteMany({ where: { uploadedBy: testUser.id } })
      await prisma.vehicle.deleteMany({ where: { createdBy: testUser.id } })
      await prisma.modelYear.deleteMany({ where: { Model: { name: { startsWith: 'DBTest' } } } })
      await prisma.model.deleteMany({ where: { name: { startsWith: 'DBTest' } } })
      await prisma.oEM.deleteMany({ where: { name: { startsWith: 'DBTest' } } })
      await prisma.user.deleteMany({ where: { id: testUser.id } })
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  describe('1. Basic CRUD Operations', () => {
    it('should create, read, update, and delete OEM', async () => {
      // CREATE
      const createdOEM = await prisma.oEM.create({
        data: {
          name: 'DBTestOEM',
          shortName: 'DTO'
        }
      })

      expect(createdOEM.id).toBeDefined()
      expect(createdOEM.name).toBe('DBTestOEM')
      expect(createdOEM.shortName).toBe('DTO')
      testOEMId = createdOEM.id

      // READ
      const foundOEM = await prisma.oEM.findUnique({
        where: { id: testOEMId }
      })

      expect(foundOEM).not.toBeNull()
      expect(foundOEM!.name).toBe('DBTestOEM')

      // UPDATE
      const updatedOEM = await prisma.oEM.update({
        where: { id: testOEMId },
        data: { name: 'DBTestOEMUpdated' }
      })

      expect(updatedOEM.name).toBe('DBTestOEMUpdated')

      // Don't delete yet - we need it for relationship tests
    })

    it('should create Model with OEM relationship', async () => {
      const createdModel = await prisma.model.create({
        data: {
          name: 'DBTestModel',
          platform: 'TestPlatform',
          oemId: testOEMId
        }
      })

      expect(createdModel.oemId).toBe(testOEMId)
      testModelId = createdModel.id
    })

    it('should create ModelYear with Model relationship', async () => {
      const currentYear = new Date().getFullYear()

      const createdModelYear = await prisma.modelYear.create({
        data: {
          year: currentYear,
          modelId: testModelId
        }
      })

      expect(createdModelYear.modelId).toBe(testModelId)
      expect(createdModelYear.year).toBe(currentYear)
      testModelYearId = createdModelYear.id
    })

    it('should create Vehicle with ModelYear relationship', async () => {
      const createdVehicle = await prisma.vehicle.create({
        data: {
          modelYearId: testModelYearId,
          vin: 'DBTEST123456789',
          createdBy: testUser.id
        }
      })

      expect(createdVehicle.modelYearId).toBe(testModelYearId)
      expect(createdVehicle.createdBy).toBe(testUser.id)
      testVehicleId = createdVehicle.id
    })

    it('should create DiagnosticJob with Vehicle and User relationships', async () => {
      const createdJob = await prisma.diagnosticJob.create({
        data: {
          name: 'DB Test Job',
          procedureType: 'Test procedure',
          vehicleId: testVehicleId,
          uploadedBy: testUser.id,
          status: 'DRAFT'
        }
      })

      expect(createdJob.vehicleId).toBe(testVehicleId)
      expect(createdJob.uploadedBy).toBe(testUser.id)
      expect(createdJob.status).toBe('DRAFT')
    })
  })

  describe('2. Unique Constraints', () => {
    it('should enforce OEM name uniqueness', async () => {
      await expect(
        prisma.oEM.create({
          data: {
            name: 'DBTestOEMUpdated', // This name already exists
            shortName: 'DTO2'
          }
        })
      ).rejects.toThrow()
    })

    it('should enforce OEM shortName uniqueness', async () => {
      await expect(
        prisma.oEM.create({
          data: {
            name: 'AnotherOEM',
            shortName: 'DTO' // This shortName already exists
          }
        })
      ).rejects.toThrow()
    })

    it('should enforce Model name uniqueness within OEM', async () => {
      await expect(
        prisma.model.create({
          data: {
            name: 'DBTestModel', // This name already exists for this OEM
            platform: 'AnotherPlatform',
            oemId: testOEMId
          }
        })
      ).rejects.toThrow()
    })

    it('should allow same Model name in different OEMs', async () => {
      const anotherOEM = await prisma.oEM.create({
        data: {
          name: 'DBTestAnotherOEM',
          shortName: 'DTAO'
        }
      })

      // This should succeed - same model name but different OEM
      const model = await prisma.model.create({
        data: {
          name: 'DBTestModel', // Same name as existing model
          platform: 'DifferentPlatform',
          oemId: anotherOEM.id
        }
      })

      expect(model.name).toBe('DBTestModel')
      expect(model.oemId).toBe(anotherOEM.id)

      // Clean up
      await prisma.model.delete({ where: { id: model.id } })
      await prisma.oEM.delete({ where: { id: anotherOEM.id } })
    })

    it('should enforce ModelYear uniqueness within Model', async () => {
      const currentYear = new Date().getFullYear()

      await expect(
        prisma.modelYear.create({
          data: {
            year: currentYear, // This year already exists for this model
            modelId: testModelId
          }
        })
      ).rejects.toThrow()
    })

    it('should enforce VIN uniqueness', async () => {
      await expect(
        prisma.vehicle.create({
          data: {
            modelYearId: testModelYearId,
            vin: 'DBTEST123456789', // This VIN already exists
            createdBy: testUser.id
          }
        })
      ).rejects.toThrow()
    })

    it('should allow NULL VINs (multiple vehicles can have NULL VIN)', async () => {
      const vehicle1 = await prisma.vehicle.create({
        data: {
          modelYearId: testModelYearId,
          vin: null,
          createdBy: testUser.id
        }
      })

      const vehicle2 = await prisma.vehicle.create({
        data: {
          modelYearId: testModelYearId,
          vin: null,
          createdBy: testUser.id
        }
      })

      expect(vehicle1.vin).toBeNull()
      expect(vehicle2.vin).toBeNull()
      expect(vehicle1.id).not.toBe(vehicle2.id)

      // Clean up
      await prisma.vehicle.deleteMany({
        where: { id: { in: [vehicle1.id, vehicle2.id] } }
      })
    })
  })

  describe('3. Foreign Key Constraints', () => {
    it('should reject Model creation with non-existent OEM', async () => {
      await expect(
        prisma.model.create({
          data: {
            name: 'InvalidModel',
            platform: 'InvalidPlatform',
            oemId: 'non-existent-oem-id'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject ModelYear creation with non-existent Model', async () => {
      await expect(
        prisma.modelYear.create({
          data: {
            year: 2023,
            modelId: 'non-existent-model-id'
          }
        })
      ).rejects.toThrow()
    })

    it('should reject Vehicle creation with non-existent ModelYear', async () => {
      await expect(
        prisma.vehicle.create({
          data: {
            modelYearId: 'non-existent-model-year-id',
            createdBy: testUser.id
          }
        })
      ).rejects.toThrow()
    })

    it('should reject DiagnosticJob creation with non-existent Vehicle', async () => {
      await expect(
        prisma.diagnosticJob.create({
          data: {
            name: 'Invalid Job',
            procedureType: 'Invalid',
            vehicleId: 'non-existent-vehicle-id',
            uploadedBy: testUser.id
          }
        })
      ).rejects.toThrow()
    })

    it('should reject DiagnosticJob creation with non-existent User', async () => {
      await expect(
        prisma.diagnosticJob.create({
          data: {
            name: 'Invalid Job',
            procedureType: 'Invalid',
            vehicleId: testVehicleId,
            uploadedBy: 'non-existent-user-id'
          }
        })
      ).rejects.toThrow()
    })
  })

  describe('4. Cascade and Restricted Deletes', () => {
    it('should prevent OEM deletion when Models exist', async () => {
      await expect(
        prisma.oEM.delete({
          where: { id: testOEMId }
        })
      ).rejects.toThrow()
    })

    it('should prevent Model deletion when ModelYears exist', async () => {
      await expect(
        prisma.model.delete({
          where: { id: testModelId }
        })
      ).rejects.toThrow()
    })

    it('should prevent ModelYear deletion when Vehicles exist', async () => {
      await expect(
        prisma.modelYear.delete({
          where: { id: testModelYearId }
        })
      ).rejects.toThrow()
    })

    it('should cascade delete DiagnosticJobs when Vehicle is deleted', async () => {
      // Create a test vehicle and job for cascade testing
      const cascadeVehicle = await prisma.vehicle.create({
        data: {
          modelYearId: testModelYearId,
          vin: 'CASCADE123456789',
          createdBy: testUser.id
        }
      })

      const cascadeJob = await prisma.diagnosticJob.create({
        data: {
          name: 'Cascade Test Job',
          procedureType: 'Cascade Test',
          vehicleId: cascadeVehicle.id,
          uploadedBy: testUser.id
        }
      })

      // Delete the vehicle - should cascade to job
      await prisma.vehicle.delete({
        where: { id: cascadeVehicle.id }
      })

      // Job should be automatically deleted
      const deletedJob = await prisma.diagnosticJob.findUnique({
        where: { id: cascadeJob.id }
      })

      expect(deletedJob).toBeNull()
    })

    it('should cascade delete User-related data when User is deleted', async () => {
      // Create a test user with associated data
      const cascadeUser = await prisma.user.create({
        data: {
          id: 'cascade-test-user',
          email: 'cascade@test.com',
          name: 'Cascade Test User',
          role: 'VIEWER'
        }
      })

      // Create an account for the user
      const userAccount = await prisma.account.create({
        data: {
          userId: cascadeUser.id,
          type: 'oauth',
          provider: 'test',
          providerAccountId: 'test-account'
        }
      })

      // Delete the user - should cascade to accounts
      await prisma.user.delete({
        where: { id: cascadeUser.id }
      })

      // Account should be automatically deleted
      const deletedAccount = await prisma.account.findUnique({
        where: { id: userAccount.id }
      })

      expect(deletedAccount).toBeNull()
    })
  })

  describe('5. Business Rule Validation', () => {
    it('should accept valid year ranges for ModelYear', async () => {
      const currentYear = new Date().getFullYear()
      const validYears = [1900, 2000, currentYear, currentYear + 1, currentYear + 2]

      for (const year of validYears) {
        const modelYear = await prisma.modelYear.create({
          data: {
            year,
            modelId: testModelId
          }
        })

        expect(modelYear.year).toBe(year)

        // Clean up
        await prisma.modelYear.delete({ where: { id: modelYear.id } })
      }
    })

    it('should validate enum values for UserRole', async () => {
      const validRoles = ['ADMIN', 'TECHNICIAN', 'VIEWER']

      for (const role of validRoles) {
        const user = await prisma.user.create({
          data: {
            id: `test-role-${role.toLowerCase()}`,
            email: `test-${role.toLowerCase()}@example.com`,
            name: `Test ${role} User`,
            role: role as 'ADMIN' | 'TECHNICIAN' | 'VIEWER'
          }
        })

        expect(user.role).toBe(role)

        // Clean up
        await prisma.user.delete({ where: { id: user.id } })
      }
    })

    it('should validate enum values for JobStatus', async () => {
      const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED']

      for (const status of validStatuses) {
        const job = await prisma.diagnosticJob.create({
          data: {
            name: `Test ${status} Job`,
            procedureType: 'Test',
            vehicleId: testVehicleId,
            uploadedBy: testUser.id,
            status: status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
          }
        })

        expect(job.status).toBe(status)

        // Clean up
        await prisma.diagnosticJob.delete({ where: { id: job.id } })
      }
    })
  })

  describe('6. Data Consistency and Relationships', () => {
    it('should maintain proper relationships with includes', async () => {
      const jobWithRelations = await prisma.diagnosticJob.findFirst({
        where: { vehicleId: testVehicleId },
        include: {
          Vehicle: {
            include: {
              ModelYear: {
                include: {
                  Model: {
                    include: {
                      OEM: true
                    }
                  }
                }
              }
            }
          },
          User: true
        }
      })

      expect(jobWithRelations).not.toBeNull()
      expect(jobWithRelations!.Vehicle).toBeDefined()
      expect(jobWithRelations!.Vehicle.ModelYear).toBeDefined()
      expect(jobWithRelations!.Vehicle.ModelYear.Model).toBeDefined()
      expect(jobWithRelations!.Vehicle.ModelYear.Model.OEM).toBeDefined()
      expect(jobWithRelations!.User).toBeDefined()

      // Verify the relationship chain
      expect(jobWithRelations!.Vehicle.ModelYear.Model.OEM.id).toBe(testOEMId)
    })

    it('should handle complex queries with filtering and sorting', async () => {
      const results = await prisma.diagnosticJob.findMany({
        where: {
          Vehicle: {
            ModelYear: {
              Model: {
                OEM: {
                  name: { startsWith: 'DBTest' }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle aggregations and counts', async () => {
      const oemWithCounts = await prisma.oEM.findUnique({
        where: { id: testOEMId },
        include: {
          _count: {
            select: {
              Model: true
            }
          }
        }
      })

      expect(oemWithCounts).not.toBeNull()
      expect(oemWithCounts!._count.Model).toBeGreaterThan(0)
    })
  })

  describe('7. Performance and Query Optimization', () => {
    it('should execute simple queries quickly', async () => {
      const startTime = Date.now()

      await prisma.oEM.findMany()

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should execute complex queries with joins efficiently', async () => {
      const startTime = Date.now()

      await prisma.diagnosticJob.findMany({
        include: {
          Vehicle: {
            include: {
              ModelYear: {
                include: {
                  Model: {
                    include: {
                      OEM: true
                    }
                  }
                }
              }
            }
          },
          User: true
        },
        take: 20
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should handle pagination efficiently', async () => {
      const pageSize = 10
      const startTime = Date.now()

      const page1 = await prisma.diagnosticJob.findMany({
        take: pageSize,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      })

      const page2 = await prisma.diagnosticJob.findMany({
        take: pageSize,
        skip: pageSize,
        orderBy: { createdAt: 'desc' }
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(1500) // Both queries should complete quickly
      expect(page1.length).toBeLessThanOrEqual(pageSize)
      expect(page2.length).toBeLessThanOrEqual(pageSize)
    })
  })
})