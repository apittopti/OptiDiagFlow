/*
  Warnings:

  - You are about to drop the column `discoveryType` on the `ODXDiscoveryResult` table. All the data in the column will be lost.
  - Added the required column `type` to the `ODXDiscoveryResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."ODXDiscoveryResult_discoveryType_idx";

-- AlterTable
ALTER TABLE "public"."ECUMapping" ADD COLUMN     "description" TEXT,
ADD COLUMN     "technicalNotes" TEXT;

-- AlterTable
ALTER TABLE "public"."ODXDiscoveryResult" DROP COLUMN "discoveryType",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "technicalNotes" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."UDSServiceTemplate" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "requestFormat" JSONB,
    "responseFormat" JSONB,
    "subfunctions" JSONB,
    "commonDIDs" JSONB,
    "securityRequired" BOOLEAN NOT NULL DEFAULT false,
    "sessionRequired" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UDSServiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultDIDs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUProfile" (
    "id" TEXT NOT NULL,
    "modelYearId" TEXT NOT NULL,
    "ecuTypeId" TEXT NOT NULL,
    "ecuAddress" TEXT NOT NULL,
    "ecuName" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'UDS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUServiceMapping" (
    "id" TEXT NOT NULL,
    "udsServiceId" TEXT NOT NULL,
    "ecuTypeId" TEXT,
    "ecuProfileId" TEXT,
    "isStandardOnECU" BOOLEAN NOT NULL DEFAULT true,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "implementationNotes" TEXT,
    "supportedSubfunctions" JSONB,
    "restrictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUServiceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StandardDID" (
    "id" TEXT NOT NULL,
    "didId" TEXT NOT NULL,
    "didName" TEXT NOT NULL,
    "description" TEXT,
    "dataLength" INTEGER,
    "dataType" TEXT,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "accessLevel" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "securityRequired" BOOLEAN NOT NULL DEFAULT false,
    "sessionRequired" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandardDID_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUSpecificDID" (
    "id" TEXT NOT NULL,
    "standardDIDId" TEXT,
    "ecuProfileId" TEXT NOT NULL,
    "didId" TEXT NOT NULL,
    "didName" TEXT NOT NULL,
    "description" TEXT,
    "dataLength" INTEGER,
    "dataType" TEXT,
    "format" JSONB,
    "ecuSpecific" BOOLEAN NOT NULL DEFAULT false,
    "isSupported" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUSpecificDID_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyDiagnosticProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "description" TEXT,
    "defaultSessionTypes" JSONB NOT NULL,
    "securityAccessLevels" JSONB NOT NULL,
    "standardServices" JSONB NOT NULL,
    "ecuSpecificServices" JSONB NOT NULL,
    "customServices" JSONB,
    "diagnosticStrategy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDiagnosticProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyServiceProfile" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "udsServiceId" TEXT NOT NULL,
    "isStandardAcrossECUs" BOOLEAN NOT NULL DEFAULT true,
    "isCompanyCustomization" BOOLEAN NOT NULL DEFAULT false,
    "customImplementation" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyServiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanySpecificDID" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "standardDIDId" TEXT,
    "didId" TEXT NOT NULL,
    "didName" TEXT NOT NULL,
    "description" TEXT,
    "dataLength" INTEGER,
    "dataType" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT true,
    "accessLevel" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySpecificDID_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UDSServiceTemplate_serviceId_key" ON "public"."UDSServiceTemplate"("serviceId");

-- CreateIndex
CREATE INDEX "UDSServiceTemplate_serviceId_idx" ON "public"."UDSServiceTemplate"("serviceId");

-- CreateIndex
CREATE INDEX "UDSServiceTemplate_category_idx" ON "public"."UDSServiceTemplate"("category");

-- CreateIndex
CREATE INDEX "UDSServiceTemplate_isStandard_idx" ON "public"."UDSServiceTemplate"("isStandard");

-- CreateIndex
CREATE UNIQUE INDEX "ECUType_name_key" ON "public"."ECUType"("name");

-- CreateIndex
CREATE INDEX "ECUType_category_idx" ON "public"."ECUType"("category");

-- CreateIndex
CREATE INDEX "ECUProfile_ecuTypeId_idx" ON "public"."ECUProfile"("ecuTypeId");

-- CreateIndex
CREATE INDEX "ECUProfile_ecuAddress_idx" ON "public"."ECUProfile"("ecuAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ECUProfile_modelYearId_ecuAddress_key" ON "public"."ECUProfile"("modelYearId", "ecuAddress");

-- CreateIndex
CREATE INDEX "ECUServiceMapping_udsServiceId_idx" ON "public"."ECUServiceMapping"("udsServiceId");

-- CreateIndex
CREATE INDEX "ECUServiceMapping_ecuTypeId_idx" ON "public"."ECUServiceMapping"("ecuTypeId");

-- CreateIndex
CREATE INDEX "ECUServiceMapping_ecuProfileId_idx" ON "public"."ECUServiceMapping"("ecuProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardDID_didId_key" ON "public"."StandardDID"("didId");

-- CreateIndex
CREATE INDEX "StandardDID_didId_idx" ON "public"."StandardDID"("didId");

-- CreateIndex
CREATE INDEX "StandardDID_isStandard_idx" ON "public"."StandardDID"("isStandard");

-- CreateIndex
CREATE INDEX "ECUSpecificDID_didId_idx" ON "public"."ECUSpecificDID"("didId");

-- CreateIndex
CREATE INDEX "ECUSpecificDID_ecuProfileId_idx" ON "public"."ECUSpecificDID"("ecuProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ECUSpecificDID_ecuProfileId_didId_key" ON "public"."ECUSpecificDID"("ecuProfileId", "didId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDiagnosticProfile_companyId_key" ON "public"."CompanyDiagnosticProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyDiagnosticProfile_companyId_idx" ON "public"."CompanyDiagnosticProfile"("companyId");

-- CreateIndex
CREATE INDEX "CompanyServiceProfile_companyProfileId_idx" ON "public"."CompanyServiceProfile"("companyProfileId");

-- CreateIndex
CREATE INDEX "CompanyServiceProfile_udsServiceId_idx" ON "public"."CompanyServiceProfile"("udsServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyServiceProfile_companyProfileId_udsServiceId_key" ON "public"."CompanyServiceProfile"("companyProfileId", "udsServiceId");

-- CreateIndex
CREATE INDEX "CompanySpecificDID_didId_idx" ON "public"."CompanySpecificDID"("didId");

-- CreateIndex
CREATE INDEX "CompanySpecificDID_companyProfileId_idx" ON "public"."CompanySpecificDID"("companyProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySpecificDID_companyProfileId_didId_key" ON "public"."CompanySpecificDID"("companyProfileId", "didId");

-- CreateIndex
CREATE INDEX "ODXDiscoveryResult_type_idx" ON "public"."ODXDiscoveryResult"("type");

-- AddForeignKey
ALTER TABLE "public"."ECUProfile" ADD CONSTRAINT "ECUProfile_modelYearId_fkey" FOREIGN KEY ("modelYearId") REFERENCES "public"."ModelYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUProfile" ADD CONSTRAINT "ECUProfile_ecuTypeId_fkey" FOREIGN KEY ("ecuTypeId") REFERENCES "public"."ECUType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUServiceMapping" ADD CONSTRAINT "ECUServiceMapping_udsServiceId_fkey" FOREIGN KEY ("udsServiceId") REFERENCES "public"."UDSServiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUServiceMapping" ADD CONSTRAINT "ECUServiceMapping_ecuTypeId_fkey" FOREIGN KEY ("ecuTypeId") REFERENCES "public"."ECUType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUServiceMapping" ADD CONSTRAINT "ECUServiceMapping_ecuProfileId_fkey" FOREIGN KEY ("ecuProfileId") REFERENCES "public"."ECUProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUSpecificDID" ADD CONSTRAINT "ECUSpecificDID_standardDIDId_fkey" FOREIGN KEY ("standardDIDId") REFERENCES "public"."StandardDID"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUSpecificDID" ADD CONSTRAINT "ECUSpecificDID_ecuProfileId_fkey" FOREIGN KEY ("ecuProfileId") REFERENCES "public"."ECUProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyDiagnosticProfile" ADD CONSTRAINT "CompanyDiagnosticProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyServiceProfile" ADD CONSTRAINT "CompanyServiceProfile_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "public"."CompanyDiagnosticProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyServiceProfile" ADD CONSTRAINT "CompanyServiceProfile_udsServiceId_fkey" FOREIGN KEY ("udsServiceId") REFERENCES "public"."UDSServiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanySpecificDID" ADD CONSTRAINT "CompanySpecificDID_companyProfileId_fkey" FOREIGN KEY ("companyProfileId") REFERENCES "public"."CompanyDiagnosticProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanySpecificDID" ADD CONSTRAINT "CompanySpecificDID_standardDIDId_fkey" FOREIGN KEY ("standardDIDId") REFERENCES "public"."StandardDID"("id") ON DELETE SET NULL ON UPDATE CASCADE;
