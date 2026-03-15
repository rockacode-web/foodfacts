import { prisma } from "../utils/prisma.js";

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createForbiddenError(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function scaleNutrient(value, servings) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * servings * 100) / 100;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfTomorrow() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function deriveSourceFoodName(scan) {
  const productName = firstNonEmptyString([
    scan.rawAiResponse?.identifiedFood?.productName,
    scan.rawAiResponse?.productName
  ]);
  const brandName = firstNonEmptyString([
    scan.rawAiResponse?.identifiedFood?.brandName,
    scan.rawAiResponse?.brandName
  ]);
  const category = firstNonEmptyString([
    scan.rawAiResponse?.identifiedFood?.category,
    scan.rawAiResponse?.category
  ]);

  return firstNonEmptyString([
    productName && brandName ? `${brandName} ${productName}` : null,
    productName,
    brandName,
    category,
    scan.summary
  ]);
}

function mapIntakeEntry(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    scanId: entry.scanId,
    servings: entry.servings,
    consumedAt: entry.consumedAt,
    createdAt: entry.createdAt,
    calories: entry.calories,
    sodiumMg: entry.sodiumMg,
    sugarG: entry.sugarG,
    saturatedFatG: entry.saturatedFatG,
    fiberG: entry.fiberG,
    proteinG: entry.proteinG,
    sourceSummary: entry.sourceSummary,
    sourceFoodName: entry.sourceFoodName
  };
}

function sumField(entries, field) {
  return Math.round(
    entries.reduce((total, entry) => total + (typeof entry[field] === "number" ? entry[field] : 0), 0) * 100
  ) / 100;
}

function buildInsights(entries, totals) {
  const insights = [];
  const missingSugarCount = entries.filter((entry) => entry.sugarG == null).length;

  if (totals.sodiumMg >= 2300) {
    insights.push("Sodium intake is high today.");
  } else if (totals.sodiumMg >= 1500) {
    insights.push("Sodium intake is building up today.");
  }

  if (totals.proteinG >= 20 && totals.proteinG < 60) {
    insights.push("Protein intake is moderate so far.");
  } else if (totals.proteinG >= 60) {
    insights.push("Protein intake is strong today.");
  }

  if (missingSugarCount > 0) {
    insights.push("Some logged foods are missing sugar data.");
  }

  if (entries.length === 0) {
    insights.push("No foods have been logged today yet.");
  }

  return insights;
}

async function findOwnedScan(scanId, userId) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      nutritionFacts: true
    }
  });

  if (!scan) {
    throw createNotFoundError("Scan not found.");
  }
  if (scan.userId !== userId) {
    throw createForbiddenError("You do not have access to this scan.");
  }

  return scan;
}

async function findOwnedIntakeEntry(entryId, userId) {
  const entry = await prisma.dailyIntakeEntry.findUnique({
    where: { id: entryId }
  });

  if (!entry) {
    throw createNotFoundError("Intake entry not found.");
  }
  if (entry.userId !== userId) {
    throw createForbiddenError("You do not have access to this intake entry.");
  }

  return entry;
}

export async function createDailyIntakeEntryForUser({ userId, scanId, servings, consumedAt }) {
  const scan = await findOwnedScan(scanId, userId);
  const nutrition = scan.nutritionFacts;

  const createdEntry = await prisma.dailyIntakeEntry.create({
    data: {
      userId,
      scanId,
      servings,
      consumedAt: consumedAt || new Date(),
      calories: scaleNutrient(nutrition?.calories, servings),
      sodiumMg: scaleNutrient(nutrition?.sodiumMg, servings),
      sugarG: scaleNutrient(nutrition?.sugarG, servings),
      saturatedFatG: scaleNutrient(nutrition?.saturatedFatG, servings),
      fiberG: scaleNutrient(nutrition?.fiberG, servings),
      proteinG: scaleNutrient(nutrition?.proteinG, servings),
      sourceSummary: scan.summary,
      sourceFoodName: deriveSourceFoodName(scan)
    }
  });

  return mapIntakeEntry(createdEntry);
}

export async function getTodayIntakeForUser(userId) {
  const todayStart = startOfToday();
  const tomorrowStart = startOfTomorrow();
  const entries = await prisma.dailyIntakeEntry.findMany({
    where: {
      userId,
      consumedAt: {
        gte: todayStart,
        lt: tomorrowStart
      }
    },
    orderBy: {
      consumedAt: "desc"
    }
  });

  const mappedEntries = entries.map(mapIntakeEntry);
  const totals = {
    calories: sumField(mappedEntries, "calories"),
    sodiumMg: sumField(mappedEntries, "sodiumMg"),
    sugarG: sumField(mappedEntries, "sugarG"),
    saturatedFatG: sumField(mappedEntries, "saturatedFatG"),
    fiberG: sumField(mappedEntries, "fiberG"),
    proteinG: sumField(mappedEntries, "proteinG")
  };

  return {
    date: formatDateKey(todayStart),
    totals,
    entries: mappedEntries,
    insights: buildInsights(mappedEntries, totals)
  };
}

export async function deleteDailyIntakeEntryForUser(entryId, userId) {
  const entry = await findOwnedIntakeEntry(entryId, userId);

  await prisma.dailyIntakeEntry.delete({
    where: { id: entryId }
  });

  return {
    id: entry.id,
    deleted: true
  };
}
