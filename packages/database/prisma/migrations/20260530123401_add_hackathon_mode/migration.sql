-- CreateEnum
CREATE TYPE "HackathonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HackathonRole" AS ENUM ('PARTICIPANT', 'MENTOR', 'JUDGE', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('PADDING', 'COSMETIC', 'DUPLICATE', 'LOW_SIGNAL', 'CRAMMING', 'PURE_NOISE', 'QUALITY_RISK');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CommitType" AS ENUM ('FEATURE', 'FIX', 'REFACTOR', 'TEST', 'DOCS', 'CHORE');

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "HackathonStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repositoryId" TEXT,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonParticipant" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "role" "HackathonRole" NOT NULL DEFAULT 'PARTICIPANT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HackathonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitAnalysis" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT NOT NULL,
    "authorUsername" TEXT,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "commitType" "CommitType" NOT NULL,
    "summary" TEXT,
    "progressValue" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "implementationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "testScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breadthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiModel" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileChange" (
    "id" TEXT NOT NULL,
    "commitAnalysisId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamProgressSnapshot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "implementationScore" DOUBLE PRECISION NOT NULL,
    "testScore" DOUBLE PRECISION NOT NULL,
    "breadthScore" DOUBLE PRECISION NOT NULL,
    "consistencyScore" DOUBLE PRECISION NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT,

    CONSTRAINT "TeamProgressSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnomalyEvent" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "commitAnalysisId" TEXT,
    "anomalyType" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "autoDetected" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "reviewedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringWeight" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringWeight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRelevanceCache" (
    "id" TEXT NOT NULL,
    "filePathHash" TEXT NOT NULL,
    "repositoryId" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "ruleBreakdown" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileRelevanceCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hackathon_status_idx" ON "Hackathon"("status");

-- CreateIndex
CREATE INDEX "Hackathon_createdBy_idx" ON "Hackathon"("createdBy");

-- CreateIndex
CREATE INDEX "Hackathon_startDate_endDate_idx" ON "Hackathon"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Team_hackathonId_idx" ON "Team"("hackathonId");

-- CreateIndex
CREATE INDEX "Team_totalScore_idx" ON "Team"("totalScore");

-- CreateIndex
CREATE INDEX "HackathonParticipant_hackathonId_idx" ON "HackathonParticipant"("hackathonId");

-- CreateIndex
CREATE INDEX "HackathonParticipant_teamId_idx" ON "HackathonParticipant"("teamId");

-- CreateIndex
CREATE INDEX "HackathonParticipant_userId_idx" ON "HackathonParticipant"("userId");

-- CreateIndex
CREATE INDEX "HackathonParticipant_role_idx" ON "HackathonParticipant"("role");

-- CreateIndex
CREATE UNIQUE INDEX "HackathonParticipant_hackathonId_userId_key" ON "HackathonParticipant"("hackathonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitAnalysis_commitSha_key" ON "CommitAnalysis"("commitSha");

-- CreateIndex
CREATE INDEX "CommitAnalysis_teamId_idx" ON "CommitAnalysis"("teamId");

-- CreateIndex
CREATE INDEX "CommitAnalysis_commitSha_idx" ON "CommitAnalysis"("commitSha");

-- CreateIndex
CREATE INDEX "CommitAnalysis_committedAt_idx" ON "CommitAnalysis"("committedAt");

-- CreateIndex
CREATE INDEX "CommitAnalysis_authorUsername_idx" ON "CommitAnalysis"("authorUsername");

-- CreateIndex
CREATE INDEX "FileChange_commitAnalysisId_idx" ON "FileChange"("commitAnalysisId");

-- CreateIndex
CREATE INDEX "FileChange_relevanceScore_idx" ON "FileChange"("relevanceScore");

-- CreateIndex
CREATE INDEX "TeamProgressSnapshot_teamId_snapshotAt_idx" ON "TeamProgressSnapshot"("teamId", "snapshotAt");

-- CreateIndex
CREATE INDEX "TeamProgressSnapshot_hackathonId_idx" ON "TeamProgressSnapshot"("hackathonId");

-- CreateIndex
CREATE INDEX "AnomalyEvent_teamId_severity_status_idx" ON "AnomalyEvent"("teamId", "severity", "status");

-- CreateIndex
CREATE INDEX "AnomalyEvent_status_idx" ON "AnomalyEvent"("status");

-- CreateIndex
CREATE INDEX "AnomalyEvent_createdAt_idx" ON "AnomalyEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ScoringWeight_hackathonId_idx" ON "ScoringWeight"("hackathonId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringWeight_hackathonId_dimension_version_key" ON "ScoringWeight"("hackathonId", "dimension", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FileRelevanceCache_filePathHash_key" ON "FileRelevanceCache"("filePathHash");

-- CreateIndex
CREATE INDEX "FileRelevanceCache_filePathHash_idx" ON "FileRelevanceCache"("filePathHash");

-- CreateIndex
CREATE INDEX "FileRelevanceCache_repositoryId_idx" ON "FileRelevanceCache"("repositoryId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonParticipant" ADD CONSTRAINT "HackathonParticipant_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonParticipant" ADD CONSTRAINT "HackathonParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonParticipant" ADD CONSTRAINT "HackathonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitAnalysis" ADD CONSTRAINT "CommitAnalysis_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChange" ADD CONSTRAINT "FileChange_commitAnalysisId_fkey" FOREIGN KEY ("commitAnalysisId") REFERENCES "CommitAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProgressSnapshot" ADD CONSTRAINT "TeamProgressSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProgressSnapshot" ADD CONSTRAINT "TeamProgressSnapshot_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyEvent" ADD CONSTRAINT "AnomalyEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnomalyEvent" ADD CONSTRAINT "AnomalyEvent_commitAnalysisId_fkey" FOREIGN KEY ("commitAnalysisId") REFERENCES "CommitAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringWeight" ADD CONSTRAINT "ScoringWeight_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
