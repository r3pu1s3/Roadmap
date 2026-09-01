/*
  Warnings:

  - A unique constraint covering the columns `[objectiveId]` on the table `ObjectiveCounter` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveCounter_objectiveId_key" ON "ObjectiveCounter"("objectiveId");
