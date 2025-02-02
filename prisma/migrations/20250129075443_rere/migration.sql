-- CreateTable
CREATE TABLE "Statictic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botSection" BOOLEAN NOT NULL DEFAULT false,
    "miniAppSection" BOOLEAN NOT NULL DEFAULT false,
    "resultSection" BOOLEAN NOT NULL DEFAULT false,
    "preSection" BOOLEAN NOT NULL DEFAULT false,
    "succesPay" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Statictic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
