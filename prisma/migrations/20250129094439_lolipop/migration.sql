/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `UserStatistics` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserStatistics_userId_key" ON "UserStatistics"("userId");
