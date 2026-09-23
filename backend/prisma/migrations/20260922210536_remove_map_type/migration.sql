/*
  Warnings:

  - You are about to drop the column `type` on the `Map` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Map" DROP COLUMN "type";

-- DropEnum
DROP TYPE "MapType";
