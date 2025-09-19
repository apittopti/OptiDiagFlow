-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'TECHNICIAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."Vehicle" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagnosticJob" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vehicleId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "procedureType" TEXT NOT NULL,
    "duration" INTEGER,
    "messageCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TraceSession" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "ecuCount" INTEGER NOT NULL DEFAULT 0,
    "parsedData" JSONB,
    "flowDiagram" JSONB,
    "sequenceDiagram" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DoipMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceAddr" TEXT NOT NULL,
    "targetAddr" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "serviceCode" TEXT,
    "serviceName" TEXT,
    "isRequest" BOOLEAN NOT NULL,
    "isResponse" BOOLEAN NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoipMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ecu" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesReceived" INTEGER NOT NULL DEFAULT 0,
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ecu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiagnosticService" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_DiagnosticJobToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DiagnosticJobToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "public"."Vehicle"("vin");

-- CreateIndex
CREATE INDEX "Vehicle_brand_idx" ON "public"."Vehicle"("brand");

-- CreateIndex
CREATE INDEX "Vehicle_model_idx" ON "public"."Vehicle"("model");

-- CreateIndex
CREATE INDEX "Vehicle_year_idx" ON "public"."Vehicle"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_brand_model_year_key" ON "public"."Vehicle"("brand", "model", "year");

-- CreateIndex
CREATE INDEX "DiagnosticJob_vehicleId_idx" ON "public"."DiagnosticJob"("vehicleId");

-- CreateIndex
CREATE INDEX "DiagnosticJob_uploadedBy_idx" ON "public"."DiagnosticJob"("uploadedBy");

-- CreateIndex
CREATE INDEX "DiagnosticJob_procedureType_idx" ON "public"."DiagnosticJob"("procedureType");

-- CreateIndex
CREATE INDEX "DiagnosticJob_status_idx" ON "public"."DiagnosticJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "public"."Tag"("name");

-- CreateIndex
CREATE INDEX "TraceSession_jobId_idx" ON "public"."TraceSession"("jobId");

-- CreateIndex
CREATE INDEX "TraceSession_userId_idx" ON "public"."TraceSession"("userId");

-- CreateIndex
CREATE INDEX "DoipMessage_sessionId_idx" ON "public"."DoipMessage"("sessionId");

-- CreateIndex
CREATE INDEX "DoipMessage_timestamp_idx" ON "public"."DoipMessage"("timestamp");

-- CreateIndex
CREATE INDEX "DoipMessage_serviceCode_idx" ON "public"."DoipMessage"("serviceCode");

-- CreateIndex
CREATE INDEX "DoipMessage_sourceAddr_idx" ON "public"."DoipMessage"("sourceAddr");

-- CreateIndex
CREATE INDEX "DoipMessage_targetAddr_idx" ON "public"."DoipMessage"("targetAddr");

-- CreateIndex
CREATE INDEX "Ecu_sessionId_idx" ON "public"."Ecu"("sessionId");

-- CreateIndex
CREATE INDEX "Ecu_address_idx" ON "public"."Ecu"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Ecu_sessionId_address_key" ON "public"."Ecu"("sessionId", "address");

-- CreateIndex
CREATE INDEX "DiagnosticService_sessionId_idx" ON "public"."DiagnosticService"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosticService_serviceId_idx" ON "public"."DiagnosticService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticService_sessionId_serviceId_key" ON "public"."DiagnosticService"("sessionId", "serviceId");

-- CreateIndex
CREATE INDEX "_DiagnosticJobToTag_B_index" ON "public"."_DiagnosticJobToTag"("B");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Vehicle" ADD CONSTRAINT "Vehicle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagnosticJob" ADD CONSTRAINT "DiagnosticJob_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagnosticJob" ADD CONSTRAINT "DiagnosticJob_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceSession" ADD CONSTRAINT "TraceSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."DiagnosticJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceSession" ADD CONSTRAINT "TraceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DoipMessage" ADD CONSTRAINT "DoipMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TraceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ecu" ADD CONSTRAINT "Ecu_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TraceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiagnosticService" ADD CONSTRAINT "DiagnosticService_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TraceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DiagnosticJobToTag" ADD CONSTRAINT "_DiagnosticJobToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."DiagnosticJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_DiagnosticJobToTag" ADD CONSTRAINT "_DiagnosticJobToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

