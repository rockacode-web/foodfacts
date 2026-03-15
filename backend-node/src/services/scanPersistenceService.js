import { prisma } from "../utils/prisma.js";
import { deleteStoredImage, saveScanImage } from "./scanStorageService.js";
import { mapScanDetail, mapScanSummary } from "../utils/scanSerializers.js";

function toNullableNumber(metric) {
  return typeof metric?.value === "number" ? metric.value : null;
}

function deriveWarningType(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("sodium")) {
    return "sodium";
  }
  if (normalized.includes("sugar")) {
    return "sugar";
  }
  if (normalized.includes("saturated fat")) {
    return "saturated_fat";
  }
  if (normalized.includes("protein")) {
    return "protein";
  }
  return "general";
}

function extractAlternatives(healthierAlternative) {
  if (!healthierAlternative) {
    return [];
  }

  const rows = Array.isArray(healthierAlternative.options)
    ? healthierAlternative.options
        .filter((option) => option?.name && option?.reason)
        .map((option) => ({
          title: String(option.name).trim(),
          description: String(option.reason).trim()
        }))
    : [];

  if (healthierAlternative.title || healthierAlternative.reason) {
    rows.unshift({
      title: healthierAlternative.title || healthierAlternative.type || "Healthier alternative",
      description: [
        healthierAlternative.reason,
        healthierAlternative.shoppingTip ? `Shopping tip: ${healthierAlternative.shoppingTip}` : null
      ]
        .filter(Boolean)
        .join(" ")
    });
  }

  return rows.filter((row) => row.title && row.description);
}

function extractRecipeIdeas(recipeIdeas) {
  return Array.isArray(recipeIdeas)
    ? recipeIdeas
        .filter((idea) => idea?.title && idea?.description && idea?.whyItIsHealthier)
        .map((idea) => ({
          title: String(idea.title).trim(),
          description: String(idea.description).trim(),
          reason: String(idea.whyItIsHealthier).trim()
        }))
    : [];
}

function detailInclude() {
  return {
    nutritionFacts: true,
    warnings: true,
    alternatives: true,
    recipeIdeas: true
  };
}

export async function persistScanResult({ userId, file, analysisResult, rawAiResponse }) {
  const storedImage = await saveScanImage(file);

  try {
    const createdScan = await prisma.$transaction(async (tx) => {
      const scan = await tx.scan.create({
        data: {
          userId,
          imagePath: storedImage.relativePath,
          analysisMode: analysisResult.analysisMode || "insufficient_data",
          summary: analysisResult.plainLanguageSummary || null,
          healthScore: typeof analysisResult.healthScore === "number" ? analysisResult.healthScore : null,
          confidenceScore:
            typeof analysisResult.confidence?.analysisConfidence === "number"
              ? analysisResult.confidence.analysisConfidence
              : typeof analysisResult.confidence === "number"
              ? analysisResult.confidence
              : null,
          rawAiResponse
        }
      });

      await tx.nutritionFacts.create({
        data: {
          scanId: scan.id,
          calories: toNullableNumber(analysisResult.nutrition?.calories),
          sodiumMg: toNullableNumber(analysisResult.nutrition?.sodium_mg),
          sugarG: toNullableNumber(analysisResult.nutrition?.sugar_g),
          saturatedFatG: toNullableNumber(analysisResult.nutrition?.saturatedFat_g),
          fiberG: toNullableNumber(analysisResult.nutrition?.fiber_g),
          proteinG: toNullableNumber(analysisResult.nutrition?.protein_g),
          sourceType:
            analysisResult.analysisReasoningSummary?.primaryEvidenceSource ||
            analysisResult.nutrition?.calories?.source ||
            "unknown",
          confidence:
            typeof analysisResult.confidence?.analysisConfidence === "number"
              ? analysisResult.confidence.analysisConfidence
              : null
        }
      });

      const warnings = Array.isArray(analysisResult.healthWarnings)
        ? analysisResult.healthWarnings.filter(Boolean).map((warning) => ({
            scanId: scan.id,
            warningType: deriveWarningType(warning),
            warningText: String(warning)
          }))
        : [];

      if (warnings.length > 0) {
        await tx.warning.createMany({ data: warnings });
      }

      const alternatives = extractAlternatives(analysisResult.healthierAlternative).map((item) => ({
        scanId: scan.id,
        title: item.title,
        description: item.description
      }));

      if (alternatives.length > 0) {
        await tx.alternative.createMany({ data: alternatives });
      }

      const recipeIdeas = extractRecipeIdeas(analysisResult.recipeIdeas).map((item) => ({
        scanId: scan.id,
        title: item.title,
        description: item.description,
        reason: item.reason
      }));

      if (recipeIdeas.length > 0) {
        await tx.recipeIdea.createMany({ data: recipeIdeas });
      }

      return tx.scan.findUnique({
        where: { id: scan.id },
        include: detailInclude()
      });
    });

    return {
      ...analysisResult,
      scanId: createdScan.id,
      imagePath: createdScan.imagePath,
      persistedAt: createdScan.createdAt
    };
  } catch (error) {
    await deleteStoredImage(storedImage.relativePath);
    throw error;
  }
}

export async function listScansForUser(userId) {
  const scans = await prisma.scan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return scans.map(mapScanSummary);
}

export async function getScanById(scanId) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    include: detailInclude()
  });
}

export async function getStoredScanForUser(scanId, userId) {
  const scan = await getScanById(scanId);
  if (!scan) {
    const error = new Error("Scan not found.");
    error.statusCode = 404;
    throw error;
  }
  if (scan.userId !== userId) {
    const error = new Error("You do not have access to this scan.");
    error.statusCode = 403;
    throw error;
  }

  return mapScanDetail(scan);
}

export async function deleteStoredScanForUser(scanId, userId) {
  const scan = await getScanById(scanId);
  if (!scan) {
    const error = new Error("Scan not found.");
    error.statusCode = 404;
    throw error;
  }
  if (scan.userId !== userId) {
    const error = new Error("You do not have access to this scan.");
    error.statusCode = 403;
    throw error;
  }

  await prisma.scan.delete({
    where: { id: scanId }
  });
  await deleteStoredImage(scan.imagePath);

  return {
    id: scan.id,
    deleted: true
  };
}
