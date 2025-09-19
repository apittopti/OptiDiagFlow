/*
  Warnings:

  - You are about to drop the column `brand` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Vehicle` table. All the data in the column will be lost.
  - Added the required column `modelYearId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ODXFileType" AS ENUM ('ODX_C', 'ODX_D', 'ODX_V', 'ODX_F', 'ODX_M', 'ODX_FD');

-- CreateEnum
CREATE TYPE "public"."DiagnosticLayerType" AS ENUM ('PROTOCOL', 'FUNCTIONAL', 'BASE_VARIANT', 'ECU_VARIANT', 'ECU_CONFIG');

-- CreateEnum
CREATE TYPE "public"."RequestResponseType" AS ENUM ('REQUEST', 'POSITIVE_RESPONSE', 'NEGATIVE_RESPONSE');

-- CreateEnum
CREATE TYPE "public"."DTCFormat" AS ENUM ('ISO_14229_3_BYTE', 'ISO_14229_2_BYTE', 'J1939_SPN_FMI', 'J2012_SPN_FMI', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "public"."ParsingRuleType" AS ENUM ('DTC_PARSING', 'SERVICE_MAPPING', 'PARAMETER_DECODING', 'STATE_DECODING', 'ROUTINE_MAPPING');

-- CreateEnum
CREATE TYPE "public"."ParsingRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "public"."ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CONFIRMED');

-- DropIndex
DROP INDEX "public"."Vehicle_brand_idx";

-- DropIndex
DROP INDEX "public"."Vehicle_brand_model_year_key";

-- DropIndex
DROP INDEX "public"."Vehicle_model_idx";

-- DropIndex
DROP INDEX "public"."Vehicle_year_idx";

-- AlterTable
ALTER TABLE "public"."Vehicle" DROP COLUMN "brand",
DROP COLUMN "model",
DROP COLUMN "year",
ADD COLUMN     "modelYearId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."OEM" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "defaultDTCFormat" "public"."DTCFormat" NOT NULL DEFAULT 'ISO_14229_3_BYTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OEM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Model" (
    "id" TEXT NOT NULL,
    "oemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT,
    "dtcFormat" "public"."DTCFormat",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModelYear" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "dtcFormat" "public"."DTCFormat",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUMapping" (
    "id" TEXT NOT NULL,
    "modelYearId" TEXT NOT NULL,
    "ecuAddress" TEXT NOT NULL,
    "ecuName" TEXT NOT NULL,
    "ecuType" TEXT,
    "protocol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParsingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "public"."ParsingRuleType" NOT NULL,
    "status" "public"."ParsingRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "oemId" TEXT,
    "modelId" TEXT,
    "modelYearId" TEXT,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" "public"."ODXFileType" NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "version" TEXT,
    "catalogName" TEXT,
    "parsedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ODXFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VehicleProject" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "vehicleClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagnosticLayer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "layerType" "public"."DiagnosticLayerType" NOT NULL,
    "protocolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BaseVariant" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ECUVariant" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "baseVariantId" TEXT,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "ecuAddress" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ECUVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagService" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "semantic" TEXT,
    "addressing" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "requestSID" TEXT NOT NULL,
    "isCyclic" BOOLEAN NOT NULL DEFAULT false,
    "isMultiple" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RequestParam" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "semantic" TEXT,
    "bytePosition" INTEGER,
    "bitPosition" INTEGER,
    "bitLength" INTEGER,
    "dataType" TEXT,
    "codedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestParam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResponseParam" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "semantic" TEXT,
    "bytePosition" INTEGER,
    "bitPosition" INTEGER,
    "bitLength" INTEGER,
    "dataType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseParam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DTCDOP" (
    "id" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "dtcNumber" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "longName" TEXT,
    "description" TEXT,
    "troubleCode" TEXT,
    "displayCode" TEXT,
    "level" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DTCDOP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EnvironmentContext" (
    "id" TEXT NOT NULL,
    "dtcId" TEXT NOT NULL,
    "paramName" TEXT NOT NULL,
    "paramValue" TEXT NOT NULL,
    "unit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FreezeFrame" (
    "id" TEXT NOT NULL,
    "dtcId" TEXT NOT NULL,
    "frameNumber" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreezeFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogicalLink" (
    "id" TEXT NOT NULL,
    "vehicleProjectId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "physicalAddress" TEXT NOT NULL,
    "functionalAddress" TEXT,
    "ecuVariantRef" TEXT,
    "baseVariantRef" TEXT,
    "protocolRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogicalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXDiscoveryResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ecuAddress" TEXT NOT NULL,
    "discoveryType" TEXT NOT NULL,
    "confidence" "public"."ConfidenceLevel" NOT NULL,
    "pattern" JSONB NOT NULL,
    "metadata" JSONB,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ODXDiscoveryResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OEM_name_key" ON "public"."OEM"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OEM_shortName_key" ON "public"."OEM"("shortName");

-- CreateIndex
CREATE INDEX "Model_platform_idx" ON "public"."Model"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "Model_oemId_name_key" ON "public"."Model"("oemId", "name");

-- CreateIndex
CREATE INDEX "ModelYear_year_idx" ON "public"."ModelYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ModelYear_modelId_year_key" ON "public"."ModelYear"("modelId", "year");

-- CreateIndex
CREATE INDEX "ECUMapping_ecuAddress_idx" ON "public"."ECUMapping"("ecuAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ECUMapping_modelYearId_ecuAddress_key" ON "public"."ECUMapping"("modelYearId", "ecuAddress");

-- CreateIndex
CREATE INDEX "ParsingRule_ruleType_idx" ON "public"."ParsingRule"("ruleType");

-- CreateIndex
CREATE INDEX "ParsingRule_status_idx" ON "public"."ParsingRule"("status");

-- CreateIndex
CREATE INDEX "ParsingRule_priority_idx" ON "public"."ParsingRule"("priority");

-- CreateIndex
CREATE INDEX "ODXFile_companyId_idx" ON "public"."ODXFile"("companyId");

-- CreateIndex
CREATE INDEX "ODXFile_fileType_idx" ON "public"."ODXFile"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "public"."Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_shortName_key" ON "public"."Company"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleProject_companyId_shortName_key" ON "public"."VehicleProject"("companyId", "shortName");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticLayer_companyId_shortName_key" ON "public"."DiagnosticLayer"("companyId", "shortName");

-- CreateIndex
CREATE UNIQUE INDEX "BaseVariant_layerId_shortName_key" ON "public"."BaseVariant"("layerId", "shortName");

-- CreateIndex
CREATE INDEX "ECUVariant_ecuAddress_idx" ON "public"."ECUVariant"("ecuAddress");

-- CreateIndex
CREATE UNIQUE INDEX "ECUVariant_layerId_shortName_key" ON "public"."ECUVariant"("layerId", "shortName");

-- CreateIndex
CREATE INDEX "DiagService_requestSID_idx" ON "public"."DiagService"("requestSID");

-- CreateIndex
CREATE UNIQUE INDEX "DiagService_layerId_shortName_key" ON "public"."DiagService"("layerId", "shortName");

-- CreateIndex
CREATE INDEX "RequestParam_serviceId_idx" ON "public"."RequestParam"("serviceId");

-- CreateIndex
CREATE INDEX "ResponseParam_serviceId_idx" ON "public"."ResponseParam"("serviceId");

-- CreateIndex
CREATE INDEX "DTCDOP_dtcNumber_idx" ON "public"."DTCDOP"("dtcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DTCDOP_layerId_dtcNumber_key" ON "public"."DTCDOP"("layerId", "dtcNumber");

-- CreateIndex
CREATE INDEX "EnvironmentContext_dtcId_idx" ON "public"."EnvironmentContext"("dtcId");

-- CreateIndex
CREATE INDEX "FreezeFrame_dtcId_idx" ON "public"."FreezeFrame"("dtcId");

-- CreateIndex
CREATE INDEX "LogicalLink_physicalAddress_idx" ON "public"."LogicalLink"("physicalAddress");

-- CreateIndex
CREATE UNIQUE INDEX "LogicalLink_vehicleProjectId_shortName_key" ON "public"."LogicalLink"("vehicleProjectId", "shortName");

-- CreateIndex
CREATE INDEX "ODXDiscoveryResult_jobId_idx" ON "public"."ODXDiscoveryResult"("jobId");

-- CreateIndex
CREATE INDEX "ODXDiscoveryResult_ecuAddress_idx" ON "public"."ODXDiscoveryResult"("ecuAddress");

-- CreateIndex
CREATE INDEX "ODXDiscoveryResult_discoveryType_idx" ON "public"."ODXDiscoveryResult"("discoveryType");

-- CreateIndex
CREATE INDEX "ODXDiscoveryResult_confidence_idx" ON "public"."ODXDiscoveryResult"("confidence");

-- CreateIndex
CREATE INDEX "Vehicle_modelYearId_idx" ON "public"."Vehicle"("modelYearId");

-- AddForeignKey
ALTER TABLE "public"."Model" ADD CONSTRAINT "Model_oemId_fkey" FOREIGN KEY ("oemId") REFERENCES "public"."OEM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModelYear" ADD CONSTRAINT "ModelYear_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_modelYearId_fkey" FOREIGN KEY ("modelYearId") REFERENCES "public"."ModelYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUMapping" ADD CONSTRAINT "ECUMapping_modelYearId_fkey" FOREIGN KEY ("modelYearId") REFERENCES "public"."ModelYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParsingRule" ADD CONSTRAINT "ParsingRule_oemId_fkey" FOREIGN KEY ("oemId") REFERENCES "public"."OEM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParsingRule" ADD CONSTRAINT "ParsingRule_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParsingRule" ADD CONSTRAINT "ParsingRule_modelYearId_fkey" FOREIGN KEY ("modelYearId") REFERENCES "public"."ModelYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXFile" ADD CONSTRAINT "ODXFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXFile" ADD CONSTRAINT "ODXFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VehicleProject" ADD CONSTRAINT "VehicleProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagnosticLayer" ADD CONSTRAINT "DiagnosticLayer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BaseVariant" ADD CONSTRAINT "BaseVariant_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "public"."DiagnosticLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUVariant" ADD CONSTRAINT "ECUVariant_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "public"."DiagnosticLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ECUVariant" ADD CONSTRAINT "ECUVariant_baseVariantId_fkey" FOREIGN KEY ("baseVariantId") REFERENCES "public"."BaseVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagService" ADD CONSTRAINT "DiagService_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "public"."DiagnosticLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RequestParam" ADD CONSTRAINT "RequestParam_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."DiagService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResponseParam" ADD CONSTRAINT "ResponseParam_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."DiagService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DTCDOP" ADD CONSTRAINT "DTCDOP_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "public"."DiagnosticLayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EnvironmentContext" ADD CONSTRAINT "EnvironmentContext_dtcId_fkey" FOREIGN KEY ("dtcId") REFERENCES "public"."DTCDOP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FreezeFrame" ADD CONSTRAINT "FreezeFrame_dtcId_fkey" FOREIGN KEY ("dtcId") REFERENCES "public"."DTCDOP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogicalLink" ADD CONSTRAINT "LogicalLink_vehicleProjectId_fkey" FOREIGN KEY ("vehicleProjectId") REFERENCES "public"."VehicleProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXDiscoveryResult" ADD CONSTRAINT "ODXDiscoveryResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."DiagnosticJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
