-- CreateTable
CREATE TABLE "public"."ODXAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ODXAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXKnowledgeBase" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userDescription" TEXT,
    "technicalNotes" TEXT,
    "symptoms" TEXT,
    "solutions" TEXT,
    "preconditions" TEXT,
    "expectedResults" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ODXKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXDescriptionVersion" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "userDescription" TEXT,
    "technicalNotes" TEXT,
    "symptoms" TEXT,
    "solutions" TEXT,
    "preconditions" TEXT,
    "expectedResults" TEXT,
    "changedBy" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ODXDescriptionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ODXTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ODXPatternTag" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ODXPatternTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ODXAuditLog_entityType_entityId_idx" ON "public"."ODXAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ODXAuditLog_userId_idx" ON "public"."ODXAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ODXAuditLog_createdAt_idx" ON "public"."ODXAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ODXKnowledgeBase_entityType_idx" ON "public"."ODXKnowledgeBase"("entityType");

-- CreateIndex
CREATE INDEX "ODXKnowledgeBase_isVerified_idx" ON "public"."ODXKnowledgeBase"("isVerified");

-- CreateIndex
CREATE INDEX "ODXKnowledgeBase_confidence_idx" ON "public"."ODXKnowledgeBase"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "ODXKnowledgeBase_entityType_entityId_key" ON "public"."ODXKnowledgeBase"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ODXDescriptionVersion_knowledgeBaseId_version_idx" ON "public"."ODXDescriptionVersion"("knowledgeBaseId", "version");

-- CreateIndex
CREATE INDEX "ODXDescriptionVersion_changedBy_idx" ON "public"."ODXDescriptionVersion"("changedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ODXTag_name_key" ON "public"."ODXTag"("name");

-- CreateIndex
CREATE INDEX "ODXTag_category_idx" ON "public"."ODXTag"("category");

-- CreateIndex
CREATE INDEX "ODXPatternTag_entityType_entityId_idx" ON "public"."ODXPatternTag"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ODXPatternTag_tagId_entityType_entityId_key" ON "public"."ODXPatternTag"("tagId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "public"."ODXAuditLog" ADD CONSTRAINT "ODXAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXKnowledgeBase" ADD CONSTRAINT "ODXKnowledgeBase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXKnowledgeBase" ADD CONSTRAINT "ODXKnowledgeBase_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXKnowledgeBase" ADD CONSTRAINT "ODXKnowledgeBase_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXDescriptionVersion" ADD CONSTRAINT "ODXDescriptionVersion_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "public"."ODXKnowledgeBase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXDescriptionVersion" ADD CONSTRAINT "ODXDescriptionVersion_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ODXPatternTag" ADD CONSTRAINT "ODXPatternTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."ODXTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
