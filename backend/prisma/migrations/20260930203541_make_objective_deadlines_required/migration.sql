/*
  Warnings:

  - Made the column `deadlineEnd` on table `Objective` required. This step will fail if there are existing NULL values in that column.
  - Made the column `deadlineStart` on table `Objective` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Objective" ALTER COLUMN "deadlineEnd" SET NOT NULL,
ALTER COLUMN "deadlineStart" SET NOT NULL;
