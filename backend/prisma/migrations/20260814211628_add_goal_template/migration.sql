-- CreateTable
CREATE TABLE "GoalTemplate" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" INTEGER,
    "rewardRule" INTEGER[],
    "deadlineRule" INTEGER[],

    CONSTRAINT "GoalTemplate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoalTemplate" ADD CONSTRAINT "GoalTemplate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GoalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
