-- CreateTable
CREATE TABLE "ObjectiveCounter" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "objectiveId" INTEGER NOT NULL,

    CONSTRAINT "ObjectiveCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveCounter_objectiveId_label_key" ON "ObjectiveCounter"("objectiveId", "label");

-- AddForeignKey
ALTER TABLE "ObjectiveCounter" ADD CONSTRAINT "ObjectiveCounter_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
