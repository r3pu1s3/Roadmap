/*
  Warnings:

  - Added the required column `isBasic` to the `Objective` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isStatic` to the `Objective` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reward` to the `Objective` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ObjCounter" ADD COLUMN     "modifier" INTEGER[];

-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "isBasic" BOOLEAN NOT NULL,
ADD COLUMN     "isStatic" BOOLEAN NOT NULL,
ADD COLUMN     "reward" INTEGER NOT NULL,
ALTER COLUMN "deadline" DROP NOT NULL;
