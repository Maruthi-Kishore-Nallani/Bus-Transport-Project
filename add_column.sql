-- Add isSuperAdmin column to Admin table
ALTER TABLE "Admin" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

