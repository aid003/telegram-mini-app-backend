/*
  Warnings:

  - You are about to drop the `Statictic` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Statictic";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "UserStatistics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botLaunch" BOOLEAN NOT NULL DEFAULT false,
    "miniAppLinkClicked" BOOLEAN NOT NULL DEFAULT false,
    "learnMoreButtonClicked" BOOLEAN NOT NULL DEFAULT false,
    "courseButtonClicked" BOOLEAN NOT NULL DEFAULT false,
    "coursePaid" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "UserStatistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
