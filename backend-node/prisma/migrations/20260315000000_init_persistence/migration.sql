-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "image_path" TEXT NOT NULL,
    "analysis_mode" TEXT NOT NULL,
    "summary" TEXT,
    "health_score" DOUBLE PRECISION,
    "confidence_score" DOUBLE PRECISION,
    "raw_ai_response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_facts" (
    "id" SERIAL NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "calories" DOUBLE PRECISION,
    "sodium_mg" DOUBLE PRECISION,
    "sugar_g" DOUBLE PRECISION,
    "saturated_fat_g" DOUBLE PRECISION,
    "fiber_g" DOUBLE PRECISION,
    "protein_g" DOUBLE PRECISION,
    "source_type" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "nutrition_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" SERIAL NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "warning_type" TEXT NOT NULL,
    "warning_text" TEXT NOT NULL,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternatives" (
    "id" SERIAL NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ideas" (
    "id" SERIAL NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "recipe_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "scans_user_id_created_at_idx" ON "scans"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_facts_scan_id_key" ON "nutrition_facts"("scan_id");

-- CreateIndex
CREATE INDEX "warnings_scan_id_idx" ON "warnings"("scan_id");

-- CreateIndex
CREATE INDEX "alternatives_scan_id_idx" ON "alternatives"("scan_id");

-- CreateIndex
CREATE INDEX "recipe_ideas_scan_id_idx" ON "recipe_ideas"("scan_id");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_facts" ADD CONSTRAINT "nutrition_facts_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ideas" ADD CONSTRAINT "recipe_ideas_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
