/*
  Warnings:

  - You are about to drop the `GoalCounter` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GoalCounter" DROP CONSTRAINT "GoalCounter_goalTemplateId_fkey";

-- AlterTable
ALTER TABLE "GoalTemplate" ADD COLUMN     "counters" TEXT[];

-- DropTable
DROP TABLE "GoalCounter";
