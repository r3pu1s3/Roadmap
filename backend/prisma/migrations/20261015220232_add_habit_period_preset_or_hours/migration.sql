-- CreateEnum
CREATE TYPE "HabitPeriod" AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "periodHours" DOUBLE PRECISION,
ADD COLUMN     "periodPreset" "HabitPeriod";
