const nullableNumber = { type: ["number", "null"] };

export const visionExtractSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "labelVisible",
    "brandName",
    "productName",
    "categoryGuess",
    "labelConfidence",
    "productConfidence",
    "categoryConfidence",
    "visibleNutrition",
    "visibleIngredients",
    "allergens",
    "notes"
  ],
  properties: {
    labelVisible: { type: "boolean" },
    brandName: { type: ["string", "null"] },
    productName: { type: ["string", "null"] },
    categoryGuess: { type: ["string", "null"] },
    labelConfidence: { type: "number", minimum: 0, maximum: 100 },
    productConfidence: { type: "number", minimum: 0, maximum: 100 },
    categoryConfidence: { type: "number", minimum: 0, maximum: 100 },
    visibleNutrition: {
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
        calories: nullableNumber,
        totalFat_g: nullableNumber,
        saturatedFat_g: nullableNumber,
        transFat_g: nullableNumber,
        cholesterol_mg: nullableNumber,
        sodium_mg: nullableNumber,
        totalCarbs_g: nullableNumber,
        fiber_g: nullableNumber,
        sugar_g: nullableNumber,
        addedSugar_g: nullableNumber,
        protein_g: nullableNumber
      }
    },
    visibleIngredients: {
      type: "array",
      items: { type: "string" }
    },
    allergens: {
      type: "array",
      items: { type: "string" }
    },
    notes: {
      type: "array",
      items: { type: "string" }
    }
  }
};
