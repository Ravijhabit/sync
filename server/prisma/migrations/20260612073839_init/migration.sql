-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('UPCOMING', 'ONGOING', 'CLOSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "UserEventStatus" AS ENUM ('IDLE', 'ENGAGED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromptDepth" AS ENUM ('SURFACE', 'MID', 'DEEP');

-- CreateEnum
CREATE TYPE "PromptCategory" AS ENUM ('FAILURE', 'CONVICTION', 'SURPRISE', 'CRAFT', 'IMPACT', 'FUTURE', 'UNLEARNING', 'PEOPLE');

-- CreateEnum
CREATE TYPE "PromptEnergy" AS ENUM ('REFLECTIVE', 'ENERGISING', 'PROVOCATIVE', 'COLLABORATIVE');

-- CreateEnum
CREATE TYPE "PromptAudience" AS ENUM ('ANY', 'TECHNICAL', 'NON_TECHNICAL', 'CROSS_FUNCTIONAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "interests" TEXT[],
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'UPCOMING',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "UserEventStatus" NOT NULL DEFAULT 'IDLE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "promptId" TEXT NOT NULL,
    "user1Meaningful" BOOLEAN,
    "user2Meaningful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_prompts" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "followUp" TEXT NOT NULL,
    "category" "PromptCategory" NOT NULL,
    "depth" "PromptDepth" NOT NULL,
    "energy" "PromptEnergy" NOT NULL,
    "audience" "PromptAudience" NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "conversation_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learnings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "rating" INTEGER,
    "feedback" TEXT,
    "isCorrect" BOOLEAN,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "learnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_events_eventId_status_idx" ON "user_events"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_events_userId_eventId_key" ON "user_events"("userId", "eventId");

-- CreateIndex
CREATE INDEX "matches_eventId_idx" ON "matches"("eventId");

-- CreateIndex
CREATE INDEX "matches_eventId_user1Id_user2Id_idx" ON "matches"("eventId", "user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "learnings_targetId_idx" ON "learnings"("targetId");

-- CreateIndex
CREATE INDEX "learnings_matchId_idx" ON "learnings"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "learnings_matchId_learnerId_key" ON "learnings"("matchId", "learnerId");

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "conversation_prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
