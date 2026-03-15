-- CreateTable
CREATE TABLE "daily_intake_entries" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "servings" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calories" DOUBLE PRECISION,
    "sodium_mg" DOUBLE PRECISION,
    "sugar_g" DOUBLE PRECISION,
    "saturated_fat_g" DOUBLE PRECISION,
    "fiber_g" DOUBLE PRECISION,
    "protein_g" DOUBLE PRECISION,
    "source_summary" TEXT,
    "source_food_name" TEXT,

    CONSTRAINT "daily_intake_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_intake_entries_user_id_consumed_at_idx" ON "daily_intake_entries"("user_id", "consumed_at");

-- CreateIndex
CREATE INDEX "daily_intake_entries_scan_id_idx" ON "daily_intake_entries"("scan_id");

-- AddForeignKey
ALTER TABLE "daily_intake_entries" ADD CONSTRAINT "daily_intake_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_intake_entries" ADD CONSTRAINT "daily_intake_entries_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
