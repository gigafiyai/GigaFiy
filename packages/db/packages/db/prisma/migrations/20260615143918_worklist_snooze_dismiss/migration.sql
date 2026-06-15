-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "snoozed_until" TIMESTAMP(3),
ADD COLUMN     "worklist_dismissed_at" TIMESTAMP(3);

