/*
  Warnings:

  - You are about to drop the column `completed` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `deadline` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `deadlineRule` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `isBasic` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `isStatic` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `reward` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the column `rewardRule` on the `Objective` table. All the data in the column will be lost.
  - You are about to drop the `ObjCounter` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ObjCounter" DROP CONSTRAINT "ObjCounter_objectiveId_fkey";

-- DropForeignKey
ALTER TABLE "Objective" DROP CONSTRAINT "Objective_parentId_fkey";

-- AlterTable
ALTER TABLE "Objective" DROP COLUMN "completed",
DROP COLUMN "deadline",
DROP COLUMN "deadlineRule",
DROP COLUMN "isBasic",
DROP COLUMN "isStatic",
DROP COLUMN "parentId",
DROP COLUMN "reward",
DROP COLUMN "rewardRule";

-- DropTable
DROP TABLE "ObjCounter";

-- CreateTable
CREATE TABLE "ObjectiveEdge" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "childId" INTEGER NOT NULL,

    CONSTRAINT "ObjectiveEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveEdge_parentId_childId_key" ON "ObjectiveEdge"("parentId", "childId");

-- AddForeignKey
ALTER TABLE "ObjectiveEdge" ADD CONSTRAINT "ObjectiveEdge_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveEdge" ADD CONSTRAINT "ObjectiveEdge_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
