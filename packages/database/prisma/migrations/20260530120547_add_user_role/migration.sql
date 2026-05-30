-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "DeveloperGraph" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDNA" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fingerprint" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDNA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MomentumSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 14,
    "velocity" DOUBLE PRECISION NOT NULL,
    "burnoutRisk" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MomentumSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillConfidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillConfidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperReputation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sources" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperReputation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitQualityScore" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "details" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitQualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeveloperGraph_userId_idx" ON "DeveloperGraph"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDNA_projectId_key" ON "ProjectDNA"("projectId");

-- CreateIndex
CREATE INDEX "BuildMemory_userId_idx" ON "BuildMemory"("userId");

-- CreateIndex
CREATE INDEX "BuildMemory_tags_idx" ON "BuildMemory"("tags");

-- CreateIndex
CREATE INDEX "MomentumSignal_userId_computedAt_idx" ON "MomentumSignal"("userId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConfidence_userId_skill_key" ON "SkillConfidence"("userId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperReputation_userId_key" ON "DeveloperReputation"("userId");

-- CreateIndex
CREATE INDEX "CoachSession_userId_createdAt_idx" ON "CoachSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommitQualityScore_commitId_key" ON "CommitQualityScore"("commitId");

-- CreateIndex
CREATE INDEX "CommitQualityScore_commitId_idx" ON "CommitQualityScore"("commitId");

-- AddForeignKey
ALTER TABLE "DeveloperGraph" ADD CONSTRAINT "DeveloperGraph_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDNA" ADD CONSTRAINT "ProjectDNA_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildMemory" ADD CONSTRAINT "BuildMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomentumSignal" ADD CONSTRAINT "MomentumSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfidence" ADD CONSTRAINT "SkillConfidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperReputation" ADD CONSTRAINT "DeveloperReputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachSession" ADD CONSTRAINT "CoachSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
