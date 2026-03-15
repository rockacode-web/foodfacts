const nutrientValueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "source"],
  properties: {
    value: { type: ["number", "null"] },
    source: {
      type: "string",
      enum: ["label", "researched_online", "estimated_category", "unknown"]
    }
  }
};

export const foodAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "labelDetected",
    "identifiedFood",
    "nutrition",
    "ocrSignals",
    "estimatedInsights",
    "ingredients",
    "allergens",
    "confidence",
    "unreadableFields",
    "plainLanguageSummary",
    "healthWarnings",
    "healthBenefits",
    "recommendedFor",
    "cautionFor",
    "healthierAlternative",
    "recipeIdeas"
  ],
  properties: {
    labelDetected: { type: "boolean" },
    identifiedFood: {
      type: "object",
      additionalProperties: false,
      required: ["brandName", "productName", "category", "confidence"],
      properties: {
        brandName: { type: ["string", "null"] },
        productName: { type: ["string", "null"] },
        category: { type: ["string", "null"] },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1
        }
      }
    },
    nutrition: {
      type: "object",
      additionalProperties: false,
      required: [
        "calories",
        "totalFat_g",
        "saturatedFat_g",
        "transFat_g",
        "cholesterol_mg",
        "sodium_mg",
        "totalCarbs_g",
        "fiber_g",
        "sugar_g",
        "addedSugar_g",
        "protein_g"
      ],
      properties: {
        calories: nutrientValueSchema,
        totalFat_g: nutrientValueSchema,
        saturatedFat_g: nutrientValueSchema,
        transFat_g: nutrientValueSchema,
        cholesterol_mg: nutrientValueSchema,
        sodium_mg: nutrientValueSchema,
        totalCarbs_g: nutrientValueSchema,
        fiber_g: nutrientValueSchema,
        sugar_g: nutrientValueSchema,
        addedSugar_g: nutrientValueSchema,
        protein_g: nutrientValueSchema
      }
    },
    ocrSignals: {
      type: "object",
      additionalProperties: false,
      required: [
        "hasStructuredNutritionTable",
        "hasServingSize",
        "hasPercentDailyValues",
        "ingredientsVisible",
        "readableFieldCount",
        "keyNutrientCount",
        "textClarity",
        "noiseLevel"
      ],
      properties: {
        hasStructuredNutritionTable: { type: "boolean" },
        hasServingSize: { type: "boolean" },
        hasPercentDailyValues: { type: "boolean" },
        ingredientsVisible: { type: "boolean" },
        readableFieldCount: {
          type: "integer",
          minimum: 0,
          maximum: 20
        },
        keyNutrientCount: {
          type: "integer",
          minimum: 0,
          maximum: 8
        },
        textClarity: {
          type: "string",
          enum: ["poor", "fair", "good", "excellent"]
        },
        noiseLevel: {
          type: "string",
          enum: ["high", "medium", "low"]
        }
      }
    },
    estimatedInsights: {
      type: "object",
      additionalProperties: false,
      required: [
        "sodiumLikelihood",
        "processingLevel",
        "generalHealthNote",
        "sugarLikelihood",
        "fiberLikelihood"
      ],
      properties: {
        sodiumLikelihood: { type: ["string", "null"] },
        processingLevel: { type: ["string", "null"] },
        generalHealthNote: { type: ["string", "null"] },
        sugarLikelihood: { type: ["string", "null"] },
        fiberLikelihood: { type: ["string", "null"] }
      }
    },
    ingredients: {
      type: "array",
      items: { type: "string" }
    },
    allergens: {
      type: "array",
      items: { type: "string" }
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    unreadableFields: {
      type: "array",
      items: { type: "string" }
    },
    plainLanguageSummary: { type: "string" },
    healthWarnings: {
      type: "array",
      items: { type: "string" }
    },
    healthBenefits: {
      type: "array",
      items: { type: "string" }
    },
    recommendedFor: {
      type: "array",
      items: { type: "string" }
    },
    cautionFor: {
      type: "array",
      items: { type: "string" }
    },
    healthierAlternative: {
      type: "object",
      additionalProperties: false,
      required: ["type", "reason"],
      properties: {
        type: { type: ["string", "null"] },
        reason: { type: ["string", "null"] }
      }
    },
    recipeIdeas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "whyItIsHealthier"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          whyItIsHealthier: { type: "string" }
        }
      }
    }
  }
};
