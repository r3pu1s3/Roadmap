/*
  Warnings:

  - You are about to drop the `GoalTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GoalTemplate" DROP CONSTRAINT "GoalTemplate_parentId_fkey";

-- DropTable
DROP TABLE "GoalTemplate";

-- CreateTable
CREATE TABLE "GoalNode" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" INTEGER,
    "rewardRule" INTEGER[],
    "deadlineRule" INTEGER[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),

    CONSTRAINT "GoalNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalCounter" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "goalNodeId" INTEGER NOT NULL,

    CONSTRAINT "GoalCounter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoalNode" ADD CONSTRAINT "GoalNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GoalNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalCounter" ADD CONSTRAINT "GoalCounter_goalNodeId_fkey" FOREIGN KEY ("goalNodeId") REFERENCES "GoalNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
