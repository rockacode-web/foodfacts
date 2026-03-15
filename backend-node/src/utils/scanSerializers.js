export function mapScanSummary(scan) {
  return {
    id: scan.id,
    imagePath: scan.imagePath,
    analysisMode: scan.analysisMode,
    summary: scan.summary,
    healthScore: scan.healthScore,
    confidenceScore: scan.confidenceScore,
    createdAt: scan.createdAt
  };
}

export function mapScanDetail(scan) {
  return {
    id: scan.id,
    imagePath: scan.imagePath,
    analysisMode: scan.analysisMode,
    summary: scan.summary,
    healthScore: scan.healthScore,
    confidenceScore: scan.confidenceScore,
    createdAt: scan.createdAt,
    nutritionFacts: scan.nutritionFacts,
    warnings: scan.warnings,
    alternatives: scan.alternatives,
    recipeIdeas: scan.recipeIdeas,
    rawAiResponse: scan.rawAiResponse
  };
}
