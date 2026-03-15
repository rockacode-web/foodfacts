package com.foodlabelscanner.service;

import com.foodlabelscanner.dto.AlternativeProductDto;
import com.foodlabelscanner.dto.RecipeDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RecipeSuggestionService {

    public List<RecipeDto> suggestRecipes(List<AlternativeProductDto> alternatives) {
        Map<String, RecipeDto> recipes = new LinkedHashMap<>();
        List<AlternativeProductDto> safeAlternatives = alternatives == null ? List.of() : alternatives;

        for (AlternativeProductDto alternative : safeAlternatives) {
            if (alternative == null || alternative.getName() == null) {
                continue;
            }

            String name = alternative.getName().toLowerCase(Locale.ROOT);

            if (name.contains("tuna")) {
                addRecipe(recipes, new RecipeDto(
                        "Tuna Rice Bowl",
                        "Quick bowl with lean protein and vegetables.",
                        List.of("Canned tuna in water", "Brown rice", "Cucumber", "Lemon", "Olive oil")
                ));
            }
            if (name.contains("chicken")) {
                addRecipe(recipes, new RecipeDto(
                        "Grilled Chicken Salad",
                        "Simple salad with lean protein and crunchy vegetables.",
                        List.of("Grilled chicken breast", "Leafy greens", "Tomato", "Cucumber", "Light vinaigrette")
                ));
            }
            if (name.contains("chickpeas") || name.contains("beans") || name.contains("lentils")) {
                addRecipe(recipes, new RecipeDto(
                        "Chickpea Wrap",
                        "Fiber-rich wrap with easy pantry ingredients.",
                        List.of("Chickpeas", "Whole-wheat wrap", "Lettuce", "Tomato", "Plain yogurt sauce")
                ));
                addRecipe(recipes, new RecipeDto(
                        "Bean Vegetable Stir-Fry",
                        "Fast stove-top meal with vegetables and plant protein.",
                        List.of("Beans", "Mixed vegetables", "Garlic", "Low-sodium soy sauce", "Brown rice")
                ));
            }
            if (name.contains("oats") || name.contains("fruit") || name.contains("yogurt")) {
                addRecipe(recipes, new RecipeDto(
                        "Oats and Fruit Bowl",
                        "No-added-sugar breakfast option.",
                        List.of("Unsweetened oats", "Fresh fruit", "Plain yogurt", "Cinnamon")
                ));
            }
            if (name.contains("fish")) {
                addRecipe(recipes, new RecipeDto(
                        "Baked Fish Plate",
                        "Lean fish meal with vegetables and simple seasoning.",
                        List.of("White fish fillet", "Broccoli", "Carrots", "Lemon", "Olive oil")
                ));
            }
        }

        if (recipes.isEmpty()) {
            addRecipe(recipes, new RecipeDto(
                    "Balanced Protein Bowl",
                    "Flexible meal template using lean protein and vegetables.",
                    List.of("Lean protein", "Whole grain", "Mixed vegetables", "Light seasoning")
            ));
            addRecipe(recipes, new RecipeDto(
                    "Simple Vegetable Wrap",
                    "Quick wrap focused on fiber and moderate sodium.",
                    List.of("Whole-wheat wrap", "Beans or chicken", "Leafy greens", "Tomato")
            ));
        }

        List<RecipeDto> output = new ArrayList<>(recipes.values());
        return output.size() > 3 ? output.subList(0, 3) : output;
    }

    private void addRecipe(Map<String, RecipeDto> recipes, RecipeDto recipeDto) {
        recipes.putIfAbsent(recipeDto.getName().toLowerCase(Locale.ROOT), recipeDto);
    }
}
