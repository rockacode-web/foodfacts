const alternativeOptionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "reason"],
  properties: {
    name: { type: "string" },
    reason: { type: "string" }
  }
};

const recipeIdeaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["level", "title", "description", "whyItIsHealthier"],
  properties: {
    level: { type: "string", enum: ["product", "category"] },
    title: { type: "string" },
    description: { type: "string" },
    whyItIsHealthier: { type: "string" }
  }
};

export const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["plainLanguageSummary", "healthierAlternative", "recipeIdeas"],
  properties: {
    plainLanguageSummary: { type: "string" },
    healthierAlternative: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["level", "title", "type", "reason", "options", "shoppingTip"],
      properties: {
        level: { type: ["string", "null"], enum: ["product", "category", null] },
        title: { type: ["string", "null"] },
        type: { type: ["string", "null"] },
        reason: { type: ["string", "null"] },
        options: {
          type: "array",
          items: alternativeOptionSchema
        },
        shoppingTip: { type: ["string", "null"] }
      }
    },
    recipeIdeas: {
      type: "array",
      items: recipeIdeaSchema
    }
  }
};
