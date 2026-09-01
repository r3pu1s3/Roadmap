/*
  Warnings:

  - You are about to drop the `GoalCounter` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GoalNode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GoalCounter" DROP CONSTRAINT "GoalCounter_goalNodeId_fkey";

-- DropForeignKey
ALTER TABLE "GoalNode" DROP CONSTRAINT "GoalNode_parentId_fkey";

-- DropTable
DROP TABLE "GoalCounter";

-- DropTable
DROP TABLE "GoalNode";

-- CreateTable
CREATE TABLE "Objective" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" INTEGER,
    "rewardRule" INTEGER[],
    "deadlineRule" INTEGER[],
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjCounter" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "objectiveId" INTEGER NOT NULL,

    CONSTRAINT "ObjCounter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjCounter" ADD CONSTRAINT "ObjCounter_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
