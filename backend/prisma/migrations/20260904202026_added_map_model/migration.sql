/*
  Warnings:

  - Added the required column `mapId` to the `Objective` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "mapId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Map" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Map_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;
