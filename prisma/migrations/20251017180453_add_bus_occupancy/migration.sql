-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "currentOccupancy" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Bus" ("createdAt", "id", "location", "name", "number", "updatedAt") SELECT "createdAt", "id", "location", "name", "number", "updatedAt" FROM "Bus";
DROP TABLE "Bus";
ALTER TABLE "new_Bus" RENAME TO "Bus";
CREATE UNIQUE INDEX "Bus_number_key" ON "Bus"("number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
