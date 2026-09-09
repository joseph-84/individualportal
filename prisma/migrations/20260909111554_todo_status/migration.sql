-- Replace Todo.done (boolean) with Todo.status (text: "todo" | "in_progress" | "done")
ALTER TABLE "Todo" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'todo';
UPDATE "Todo" SET "status" = 'done' WHERE "done" = true;
ALTER TABLE "Todo" DROP COLUMN "done";
