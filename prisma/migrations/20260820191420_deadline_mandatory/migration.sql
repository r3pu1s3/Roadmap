/*
  Warnings:

  - Made the column `deadline` on table `GoalNode` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GoalNode" ALTER COLUMN "deadline" SET NOT NULL;
