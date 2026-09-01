-- DropForeignKey
ALTER TABLE "ObjCounter" DROP CONSTRAINT "ObjCounter_objectiveId_fkey";

-- AddForeignKey
ALTER TABLE "ObjCounter" ADD CONSTRAINT "ObjCounter_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
