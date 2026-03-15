function uniqueByTitle(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = (item?.title || "").toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
}

function hasAny(source, terms) {
  return terms.some((term) => source.includes(term));
}

function contextText(scan, warnings) {
  const fields = [
    scan.identifiedFood?.brandName || "",
    scan.identifiedFood?.productName || "",
    scan.identifiedFood?.category || "",
    ...(scan.ingredients || []),
    ...(warnings || [])
  ];
  return fields.join(" ").toLowerCase();
}

function toAlternativeDescription(description) {
  if (typeof description !== "string" || !description.trim()) {
    return "A lighter alternative to choose instead of this product.";
  }

  const trimmed = description.trim();
  if (/\b(instead of|swap|replace|alternative)\b/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed} Choose this instead of the current item for a lighter option.`;
}

function normalizeSwapIdeas(items, level) {
  return (items || [])
    .map((item) => ({
      level: item?.level || level,
      title: typeof item?.title === "string" ? item.title.trim() : "",
      description: toAlternativeDescription(item?.description),
      whyItIsHealthier:
        typeof item?.whyItIsHealthier === "string" && item.whyItIsHealthier.trim()
          ? item.whyItIsHealthier.trim()
          : "Usually a lighter choice with less sodium, less saturated fat, or less processing."
    }))
    .filter((item) => item.title && item.description && item.whyItIsHealthier);
}

function fallbackSwapIdeasForCategory(categoryText) {
  if (hasAny(categoryText, ["processed meat", "sausage", "ham", "corned beef", "deli", "processed canned meat"])) {
    return [
      {
        level: "category",
        title: "Tuna Rice Bowl",
        description: "Swap the canned meat for tuna in water, rice, cucumber, tomato, and a squeeze of lime.",
        whyItIsHealthier: "Usually lower in sodium and saturated fat than processed canned meats."
      },
      {
        level: "category",
        title: "Grilled Chicken Salad",
        description: "Replace the processed meat with grilled chicken breast, lettuce, tomato, cucumber, and a light dressing.",
        whyItIsHealthier: "Gives lean protein with fewer additives and less sodium."
      },
      {
        level: "category",
        title: "Chickpea Wrap",
        description: "Use mashed chickpeas, lettuce, tomato, and yogurt sauce instead of processed meat in a whole-grain wrap.",
        whyItIsHealthier: "Adds fiber and cuts down on processed meat, sodium, and saturated fat."
      }
    ];
  }

  if (hasAny(categoryText, ["cereal", "sweet", "granola"])) {
    return [
      {
        level: "category",
        title: "Plain Oats With Fruit",
        description: "Replace sugary cereal with plain oats topped with banana, berries, and cinnamon.",
        whyItIsHealthier: "Usually lowers added sugar and boosts fiber."
      },
      {
        level: "category",
        title: "Plain Yogurt Breakfast Bowl",
        description: "Choose plain yogurt with fruit and nuts instead of a sweeter boxed cereal.",
        whyItIsHealthier: "Adds protein and lowers sugar load."
      },
      {
        level: "category",
        title: "High-Fiber Low-Sugar Cereal",
        description: "Swap to a cereal with less added sugar and add fresh fruit for sweetness.",
        whyItIsHealthier: "Improves fiber intake and reduces sugar spikes."
      }
    ];
  }

  if (hasAny(categoryText, ["chips", "snack", "cracker"])) {
    return [
      {
        level: "category",
        title: "Air-Popped Popcorn",
        description: "Choose air-popped popcorn with light seasoning instead of salty packaged chips.",
        whyItIsHealthier: "Usually lower in fat and sodium when prepared simply."
      },
      {
        level: "category",
        title: "Roasted Chickpeas",
        description: "Swap to roasted chickpeas for a crunchy snack with more protein and fiber.",
        whyItIsHealthier: "More filling and typically more nutrient-dense than chips."
      },
      {
        level: "category",
        title: "Fruit and Nuts Snack Plate",
        description: "Replace the packaged snack with fruit, peanuts, or almonds for a quick snack.",
        whyItIsHealthier: "Adds whole-food nutrients and reduces ultra-processed ingredients."
      }
    ];
  }

  if (hasAny(categoryText, ["soda", "soft drink", "sweetened beverage"])) {
    return [
      {
        level: "category",
        title: "Citrus Sparkling Water",
        description: "Replace soda with sparkling water plus lime, lemon, or orange slices.",
        whyItIsHealthier: "Keeps the fizzy feel without added sugar."
      },
      {
        level: "category",
        title: "Unsweetened Iced Tea",
        description: "Choose chilled unsweetened tea with mint or lemon instead of regular soda.",
        whyItIsHealthier: "Cuts added sugar sharply."
      }
    ];
  }

  if (hasAny(categoryText, ["instant noodle", "ramen", "noodles"])) {
    return [
      {
        level: "category",
        title: "Vegetable Egg Rice Bowl",
        description: "Swap instant noodles for rice, vegetables, and boiled egg or tofu.",
        whyItIsHealthier: "Usually lower in sodium and more balanced."
      },
      {
        level: "category",
        title: "Plain Noodles With Homemade Broth",
        description: "Choose plain noodles with homemade broth and vegetables instead of seasoning-packet noodles.",
        whyItIsHealthier: "Lets you control sodium and add more real ingredients."
      }
    ];
  }

  if (hasAny(categoryText, ["processed packaged food", "packaged food", "processed food"])) {
    return [
      {
        level: "category",
        title: "Beans and Rice Bowl",
        description: "Replace the packaged item with beans, rice, and vegetables for a simple pantry meal.",
        whyItIsHealthier: "Usually less processed, with more fiber and better fullness."
      },
      {
        level: "category",
        title: "Grilled Protein Plate",
        description: "Choose grilled chicken or fish with vegetables instead of the processed packaged option.",
        whyItIsHealthier: "Cuts sodium and additives while improving nutrient quality."
      },
      {
        level: "category",
        title: "Whole-Grain Sandwich With Egg or Tuna",
        description: "Swap to a whole-grain sandwich with egg, tuna in water, lettuce, and tomato.",
        whyItIsHealthier: "Can be less processed and more balanced."
      }
    ];
  }

  return [];
}

function deriveAlternative(context) {
  if (hasAny(context, ["processed meat", "sausage", "corned beef", "ham", "deli"])) {
    return {
      level: "category",
      title: "Better Lower-Sodium Protein Options",
      type: "Lower-sodium protein swaps",
      reason: "This looks like a salty processed meat category, so lower-sodium protein options are likely better everyday choices.",
      options: [
        {
          name: "Tuna in water (no added salt)",
          reason: "Usually lower in sodium than salted canned meats."
        },
        {
          name: "Low-sodium canned mackerel or sardines",
          reason: "Can provide protein with less added sodium when label-selected carefully."
        },
        {
          name: "Beans or lentils",
          reason: "High in fiber and generally less processed."
        }
      ],
      shoppingTip: "Look for options under 200mg sodium per serving."
    };
  }
  if (hasAny(context, ["processed canned meat"])) {
    return {
      level: "category",
      title: "Better Lower-Sodium Protein Options",
      type: "Lower-sodium protein swaps",
      reason: "This appears similar to a processed canned meat, so lower-sodium protein options are likely better choices.",
      options: [
        {
          name: "Tuna in water (no added salt)",
          reason: "Usually lower in sodium than heavily salted canned meats."
        },
        {
          name: "Beans or lentils",
          reason: "Less processed and higher in fiber."
        },
        {
          name: "Grilled chicken or baked fish",
          reason: "Can provide protein with less salt and fewer additives."
        }
      ],
      shoppingTip: "Look for products with less than 200mg sodium per serving."
    };
  }
  if (hasAny(context, ["cereal", "sweet", "added sugar"])) {
    return {
      level: "category",
      title: "Try unsweetened high-fiber cereal options",
      type: "Unsweetened breakfast base",
      reason: "Choose unsweetened oats or lower-sugar cereal with fruit and plain yogurt.",
      options: [
        {
          name: "Unsweetened oats",
          reason: "Typically higher fiber and lower added sugar."
        },
        {
          name: "High-fiber cereal with low added sugar",
          reason: "Supports steadier energy and lower sugar spikes."
        },
        {
          name: "Plain yogurt + fruit + nuts",
          reason: "Adds protein and healthy fats with less added sugar."
        }
      ],
      shoppingTip: "Choose cereals with <=6g added sugar and >=3g fiber per serving."
    };
  }
  if (hasAny(context, ["chips", "snack", "cracker"])) {
    return {
      level: "category",
      title: "Try baked snack alternatives",
      type: "Baked whole-food snacks",
      reason: "Choose baked chickpeas, nuts, or air-popped options with less sodium.",
      options: [
        {
          name: "Air-popped popcorn",
          reason: "Lower fat and can be lower sodium when lightly seasoned."
        },
        {
          name: "Roasted chickpeas",
          reason: "Adds protein and fiber compared with many chips."
        },
        {
          name: "Whole-grain crackers + hummus",
          reason: "Better nutrient density and satiety."
        }
      ],
      shoppingTip: "Aim for snacks under 150mg sodium per serving."
    };
  }
  if (hasAny(context, ["soda", "soft drink"])) {
    return {
      level: "category",
      title: "Try no-added-sugar beverage swaps",
      type: "No-added-sugar beverages",
      reason: "Switch to sparkling water, unsweetened tea, or infused water.",
      options: [
        {
          name: "Sparkling water + citrus",
          reason: "No added sugar while keeping a fizzy taste."
        },
        {
          name: "Unsweetened iced tea",
          reason: "Much lower sugar than regular soda."
        },
        {
          name: "Infused water",
          reason: "Flavor without added sweeteners."
        }
      ],
      shoppingTip: "Look for beverages with 0g added sugar."
    };
  }
  if (hasAny(context, ["instant noodle", "ramen", "noodles"])) {
    return {
      level: "category",
      title: "Try lower-sodium noodle pairings",
      type: "Lower-sodium noodle swap",
      reason: "Use plain noodles with vegetables, egg, tuna, and lower-sodium broth.",
      options: [
        {
          name: "Plain noodles + homemade broth",
          reason: "Lets you control sodium better than seasoning packets."
        },
        {
          name: "Noodles + egg + vegetables",
          reason: "Improves protein and fiber balance."
        },
        {
          name: "Brown rice + vegetables + tuna",
          reason: "Alternative meal pattern with less sodium load."
        }
      ],
      shoppingTip: "Use half seasoning packet and choose lower-sodium broth."
    };
  }
  if (hasAny(context, ["processed packaged food", "packaged food", "processed food"])) {
    return {
      level: "category",
      title: "Try a less-processed option in the same category",
      type: "Category-level healthier swap",
      reason:
        "This appears to be a processed packaged food; lower-sodium and less-processed options are usually better.",
      options: [
        {
          name: "Less-processed equivalent in same category",
          reason: "Usually lower sodium and fewer additives."
        },
        {
          name: "Whole-food protein + vegetables",
          reason: "Improves nutrient density and balance."
        }
      ],
      shoppingTip: "Compare labels and prioritize lower sodium and shorter ingredient lists."
    };
  }
  return null;
}

export function buildRecommendations(scan, computedWarnings) {
  const text = contextText(scan, computedWarnings);
  const baseSwapIdeas = normalizeSwapIdeas(Array.isArray(scan.recipeIdeas) ? scan.recipeIdeas : [], "product");
  const fallback = fallbackSwapIdeasForCategory(text);
  const merged = uniqueByTitle([...fallback, ...baseSwapIdeas]).slice(0, 3);

  const existingAlt = scan.healthierAlternative || { type: null, reason: null };
  const derivedAlt = deriveAlternative(text);
  const healthierAlternative =
    existingAlt.type || existingAlt.reason || existingAlt.title
      ? { level: "product", ...existingAlt }
      : derivedAlt || null;

  return {
    healthierAlternative,
    recipeIdeas: merged
  };
}
