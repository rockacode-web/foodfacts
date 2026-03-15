package com.foodlabelscanner.service;

import com.foodlabelscanner.dto.NutritionDataDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;

@Service
public class NutritionAnalysisService {

    public List<String> generateWarnings(NutritionDataDto nutritionData) {
        List<String> warnings = new ArrayList<>();

        if (nutritionData == null) {
            return warnings;
        }

        if (nutritionData.getSugar() != null && nutritionData.getSugar() > 22) {
            warnings.add("High sugar detected.");
        }
        if (nutritionData.getSodium() != null && nutritionData.getSodium() > 400) {
            warnings.add("High sodium detected.");
        }
        if (nutritionData.getSaturatedFat() != null && nutritionData.getSaturatedFat() > 5) {
            warnings.add("High saturated fat detected.");
        }
        if (nutritionData.getCalories() != null && nutritionData.getCalories() > 350) {
            warnings.add("High calories detected.");
        }
        if (nutritionData.getProtein() != null && nutritionData.getProtein() < 3) {
            warnings.add("Low protein detected.");
        }

        return warnings;
    }

    public Integer calculateScore(NutritionDataDto nutritionData) {
        if (!hasAnyParsedField(nutritionData)) {
            return 0;
        }

        int score = 10;

        if (nutritionData.getSugar() != null) {
            double sugar = nutritionData.getSugar();
            if (sugar > 30) {
                score -= 4;
            } else if (sugar > 22) {
                score -= 3;
            } else if (sugar > 10) {
                score -= 1;
            }
        }

        if (nutritionData.getSodium() != null) {
            double sodium = nutritionData.getSodium();
            if (sodium > 700) {
                score -= 4;
            } else if (sodium > 400) {
                score -= 3;
            } else if (sodium > 200) {
                score -= 1;
            }
        }

        if (nutritionData.getSaturatedFat() != null) {
            double saturatedFat = nutritionData.getSaturatedFat();
            if (saturatedFat > 8) {
                score -= 3;
            } else if (saturatedFat > 5) {
                score -= 2;
            } else if (saturatedFat > 2) {
                score -= 1;
            }
        }

        if (nutritionData.getCalories() != null) {
            double calories = nutritionData.getCalories();
            if (calories > 500) {
                score -= 3;
            } else if (calories > 350) {
                score -= 2;
            } else if (calories > 200) {
                score -= 1;
            }
        }

        if (nutritionData.getProtein() != null) {
            double protein = nutritionData.getProtein();
            if (protein < 3) {
                score -= 1;
            } else if (protein >= 8) {
                score += 1;
            }
        }

        if (score < 0) {
            return 0;
        }
        if (score > 10) {
            return 10;
        }
        return score;
    }

    public String generateExplanation(NutritionDataDto nutritionData, List<String> warnings) {
        if (!hasAnyParsedField(nutritionData)) {
            return "Unable to compute full nutrition analysis because OCR parsing did not detect nutrition fields.";
        }

        if (warnings == null || warnings.isEmpty()) {
            return "No high-risk nutrition thresholds were triggered from the parsed label values.";
        }

        StringJoiner joiner = new StringJoiner(" ");
        joiner.add("Analysis derived from parsed nutrition fields.");
        joiner.add("Warnings:");
        joiner.add(String.join(" ", warnings));
        return joiner.toString();
    }

    private boolean hasAnyParsedField(NutritionDataDto nutritionData) {
        if (nutritionData == null) {
            return false;
        }

        return nutritionData.getCalories() != null
                || nutritionData.getSugar() != null
                || nutritionData.getSodium() != null
                || nutritionData.getSaturatedFat() != null
                || nutritionData.getProtein() != null
                || (nutritionData.getIngredients() != null && !nutritionData.getIngredients().isBlank());
    }
}
