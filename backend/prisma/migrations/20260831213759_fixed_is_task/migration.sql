/*
  Warnings:

  - You are about to drop the column `isTask` on the `ObjectiveEdge` table. All the data in the column will be lost.
  - Added the required column `isTask` to the `Objective` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "isTask" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "ObjectiveEdge" DROP COLUMN "isTask";
