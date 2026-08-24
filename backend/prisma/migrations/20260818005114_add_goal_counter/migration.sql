-- CreateTable
CREATE TABLE "GoalCounter" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "goalTemplateId" INTEGER NOT NULL,

    CONSTRAINT "GoalCounter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoalCounter" ADD CONSTRAINT "GoalCounter_goalTemplateId_fkey" FOREIGN KEY ("goalTemplateId") REFERENCES "GoalTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
