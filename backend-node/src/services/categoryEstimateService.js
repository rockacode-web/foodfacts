function categoryText(scan) {
  return [
    scan.identifiedFood?.brandName || "",
    scan.identifiedFood?.productName || "",
    scan.identifiedFood?.category || ""
  ]
    .join(" ")
    .toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function setEstimatedSource(nutrition, keys) {
  const next = { ...nutrition };
  for (const key of keys) {
    const metric = next[key] || { value: null, source: "unknown" };
    if (metric.value == null && metric.source === "unknown") {
      next[key] = {
        value: null,
        source: "estimated_category"
      };
    }
  }
  return next;
}

function applyEstimatedValues(nutrition, estimatedValues = {}) {
  const next = { ...nutrition };
  for (const [key, value] of Object.entries(estimatedValues)) {
    const metric = next[key] || { value: null, source: "unknown" };
    if (metric.value == null && Number.isFinite(value)) {
      next[key] = {
        value,
        source: "estimated_category"
      };
    }
  }
  return next;
}

function applyRule(scan, rule) {
  const baseInsights = scan.estimatedInsights || {
    sodiumLikelihood: null,
    processingLevel: null,
    generalHealthNote: null,
    sugarLikelihood: null,
    fiberLikelihood: null
  };

  const mergedInsights = {
    sodiumLikelihood: baseInsights.sodiumLikelihood || rule.insights.sodiumLikelihood || null,
    processingLevel: baseInsights.processingLevel || rule.insights.processingLevel || null,
    generalHealthNote: baseInsights.generalHealthNote || rule.insights.generalHealthNote || null,
    sugarLikelihood: baseInsights.sugarLikelihood || rule.insights.sugarLikelihood || null,
    fiberLikelihood: baseInsights.fiberLikelihood || rule.insights.fiberLikelihood || null
  };

  return {
    ...scan,
    nutrition: applyEstimatedValues(
      setEstimatedSource(scan.nutrition, rule.estimatedKeys),
      rule.estimatedValues || {}
    ),
    estimatedInsights: mergedInsights,
    estimatedRanges: {
      ...(scan.estimatedRanges || {}),
      ...(rule.estimatedRanges || {})
    }
  };
}

export function applyCategoryEstimates(scan, options = {}) {
  const allowEstimates = options.allowEstimates !== false;
  const categoryConfidence =
    typeof options.categoryConfidence === "number" ? options.categoryConfidence : 0;
  const threshold = typeof options.threshold === "number" ? options.threshold : 0.58;

  if (!allowEstimates || categoryConfidence < threshold) {
    return scan;
  }

  const text = categoryText(scan);
  if (!text.trim()) {
    return scan;
  }

  const rules = [
    {
      match: hasAny(text, ["sausage", "corned beef", "ham", "deli", "processed meat", "processed canned meat", "canned meat", "salty packaged protein"]),
      estimatedKeys: ["calories", "sodium_mg", "saturatedFat_g", "cholesterol_mg", "protein_g", "sugar_g", "fiber_g"],
      estimatedValues: {
        calories: 160,
        sodium_mg: 900,
        saturatedFat_g: 6,
        protein_g: 12
      },
      estimatedRanges: {
        calories: "120-180 per serving",
        sodium_mg: "700-1200 mg per serving",
        saturatedFat_g: "4-8 g per serving"
      },
      insights: {
        sodiumLikelihood: "Likely high sodium for this processed meat category.",
        processingLevel: "Heavily processed",
        generalHealthNote:
          "This appears to be a processed meat product. Consider smaller portions and high-fiber sides.",
        sugarLikelihood: "Likely low sugar",
        fiberLikelihood: "Likely low fiber"
      }
    },
    {
      match: hasAny(text, ["cereal", "sweet cereal", "granola", "breakfast cereal"]),
      estimatedKeys: ["sodium_mg", "sugar_g", "addedSugar_g", "fiber_g"],
      estimatedValues: {
        calories: 140,
        sugar_g: 12,
        addedSugar_g: 9,
        fiber_g: 2,
        protein_g: 3
      },
      estimatedRanges: {
        calories: "110-180 per serving",
        sugar_g: "8-16 g per serving",
        fiber_g: "1-4 g per serving"
      },
      insights: {
        sodiumLikelihood: "Likely low to moderate sodium.",
        processingLevel: "Moderately to heavily processed",
        generalHealthNote:
          "Many sweetened cereals are higher in sugar and lower in fiber unless explicitly whole-grain.",
        sugarLikelihood: "Likely moderate to high sugar",
        fiberLikelihood: "Likely low to moderate fiber"
      }
    },
    {
      match: hasAny(text, ["chips", "snack", "crisps", "cracker"]),
      estimatedKeys: ["sodium_mg", "totalFat_g", "saturatedFat_g", "fiber_g", "sugar_g"],
      estimatedValues: {
        calories: 160,
        sodium_mg: 180,
        totalFat_g: 10,
        saturatedFat_g: 2,
        fiber_g: 1
      },
      estimatedRanges: {
        calories: "140-180 per serving",
        sodium_mg: "140-260 mg per serving",
        totalFat_g: "8-12 g per serving"
      },
      insights: {
        sodiumLikelihood: "Likely moderate to high sodium.",
        processingLevel: "Likely ultra-processed",
        generalHealthNote:
          "Packaged salty snacks are commonly high in sodium and lower in fiber density.",
        sugarLikelihood: "Likely low sugar",
        fiberLikelihood: "Likely low fiber"
      }
    },
    {
      match: hasAny(text, ["soda", "soft drink", "cola", "sweetened beverage"]),
      estimatedKeys: ["sodium_mg", "sugar_g", "addedSugar_g", "fiber_g"],
      estimatedValues: {
        calories: 140,
        sugar_g: 35,
        addedSugar_g: 35
      },
      estimatedRanges: {
        calories: "120-180 per can",
        sugar_g: "28-42 g per can"
      },
      insights: {
        sodiumLikelihood: "Usually low sodium.",
        processingLevel: "Highly processed sweetened beverage",
        generalHealthNote:
          "Sweetened drinks often raise sugar intake quickly with limited satiety.",
        sugarLikelihood: "Likely high sugar",
        fiberLikelihood: "Likely no fiber"
      }
    },
    {
      match: hasAny(text, ["instant noodle", "ramen", "noodles", "cup noodles"]),
      estimatedKeys: ["sodium_mg", "totalFat_g", "protein_g", "fiber_g", "sugar_g"],
      estimatedValues: {
        calories: 200,
        sodium_mg: 900,
        totalFat_g: 8,
        protein_g: 6,
        fiber_g: 2
      },
      estimatedRanges: {
        calories: "170-250 per serving",
        sodium_mg: "700-1300 mg per serving"
      },
      insights: {
        sodiumLikelihood: "Likely high sodium from seasoning packets.",
        processingLevel: "Heavily processed convenience food",
        generalHealthNote:
          "Instant noodles are often high in sodium and lower in fiber unless paired with vegetables/protein.",
        sugarLikelihood: "Likely low sugar",
        fiberLikelihood: "Likely low fiber"
      }
    },
    {
      match: hasAny(text, ["processed packaged food", "packaged food", "processed food", "packaged item"]),
      estimatedKeys: ["sodium_mg", "sugar_g", "addedSugar_g", "fiber_g"],
      estimatedValues: {
        calories: 160,
        sodium_mg: 450,
        sugar_g: 6,
        addedSugar_g: 4,
        fiber_g: 2
      },
      estimatedRanges: {
        calories: "120-220 per serving",
        sodium_mg: "250-700 mg per serving"
      },
      insights: {
        sodiumLikelihood: "Likely moderate sodium for processed packaged foods.",
        processingLevel: "Likely processed packaged food",
        generalHealthNote:
          "This appears to be a processed packaged item. Pairing with whole foods can improve balance.",
        sugarLikelihood: "Sugar may be moderate depending on product type",
        fiberLikelihood: "Fiber may be low"
      }
    }
  ];

  const matched = rules.find((rule) => rule.match);
  if (!matched) {
    return scan;
  }

  return applyRule(scan, matched);
}
