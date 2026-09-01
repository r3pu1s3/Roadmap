/*
  Warnings:

  - Added the required column `isTask` to the `ObjectiveEdge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ObjectiveEdge" ADD COLUMN     "isTask" BOOLEAN NOT NULL;
