/*
  Warnings:

  - Added the required column `type` to the `Map` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MapType" AS ENUM ('Project', 'Habit');

-- AlterTable
ALTER TABLE "Map" ADD COLUMN     "type" "MapType" NOT NULL;
