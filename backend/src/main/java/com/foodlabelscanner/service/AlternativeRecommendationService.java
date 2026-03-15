package com.foodlabelscanner.service;

import com.foodlabelscanner.dto.AlternativeProductDto;
import com.foodlabelscanner.dto.NutritionDataDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AlternativeRecommendationService {

    public List<AlternativeProductDto> recommend(
            NutritionDataDto nutritionData,
            List<String> warnings
    ) {
        Map<String, AlternativeProductDto> alternatives = new LinkedHashMap<>();
        boolean highSodium = hasWarning(warnings, "high sodium") || valueOver(nutritionData.getSodium(), 400);
        boolean highSugar = hasWarning(warnings, "high sugar") || valueOver(nutritionData.getSugar(), 22);
        boolean highSaturatedFat = hasWarning(warnings, "high saturated fat") || valueOver(nutritionData.getSaturatedFat(), 5);
        boolean highCalories = hasWarning(warnings, "high calories") || valueOver(nutritionData.getCalories(), 350);

        if (highSodium) {
            addAlternative(alternatives, new AlternativeProductDto(
                    "Canned tuna in water",
                    "Usually lower in sodium than heavily salted processed meats.",
                    "Low-sodium protein"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Grilled chicken breast",
                    "A lean protein option with less sodium when lightly seasoned.",
                    "Lean protein"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "No-salt-added chickpeas",
                    "Adds protein and fiber with better sodium control.",
                    "Plant protein"
            ));
        }

        if (highSugar) {
            addAlternative(alternatives, new AlternativeProductDto(
                    "Plain yogurt",
                    "Provides protein without added sugar found in many sweet snacks.",
                    "Lower-sugar snack"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Unsweetened oats",
                    "A filling base that avoids added sugars.",
                    "Whole grain"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Fresh fruit and nuts",
                    "Natural sweetness with fiber and healthy fats.",
                    "Balanced snack"
            ));
        }

        if (highSaturatedFat) {
            addAlternative(alternatives, new AlternativeProductDto(
                    "Baked white fish",
                    "Typically lower in saturated fat while still protein-rich.",
                    "Lean protein"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Lean turkey",
                    "A lower saturated fat alternative to fatty processed meats.",
                    "Lean protein"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Lentils or beans",
                    "Plant proteins with little saturated fat.",
                    "Plant protein"
            ));
        }

        if (highCalories && alternatives.isEmpty()) {
            addAlternative(alternatives, new AlternativeProductDto(
                    "Vegetable and bean bowl",
                    "Higher fiber meals can help reduce calorie density per serving.",
                    "Balanced meal"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Grilled chicken salad",
                    "Lean protein and vegetables can reduce total calories.",
                    "Balanced meal"
            ));
        }

        if (alternatives.isEmpty()) {
            addAlternative(alternatives, new AlternativeProductDto(
                    "Whole-food protein + vegetables",
                    "Keeps sodium, sugar, and saturated fat easier to manage.",
                    "General healthy swap"
            ));
            addAlternative(alternatives, new AlternativeProductDto(
                    "Beans with brown rice",
                    "A balanced meal pattern with fiber and protein.",
                    "Balanced meal"
            ));
        }

        List<AlternativeProductDto> output = new ArrayList<>(alternatives.values());
        return output.size() > 3 ? output.subList(0, 3) : output;
    }

    private void addAlternative(Map<String, AlternativeProductDto> alternatives, AlternativeProductDto dto) {
        alternatives.putIfAbsent(dto.getName().toLowerCase(Locale.ROOT), dto);
    }

    private boolean hasWarning(List<String> warnings, String phrase) {
        if (warnings == null || warnings.isEmpty()) {
            return false;
        }
        String lower = phrase.toLowerCase(Locale.ROOT);
        return warnings.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(item -> item.toLowerCase(Locale.ROOT))
                .anyMatch(item -> item.contains(lower));
    }

    private boolean valueOver(Double value, double threshold) {
        return value != null && value > threshold;
    }
}
