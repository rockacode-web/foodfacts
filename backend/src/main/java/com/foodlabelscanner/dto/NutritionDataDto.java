package com.foodlabelscanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor

public class NutritionDataDto {
    private Double calories;
    private Double sugar;
    private Double sodium;
    private Double saturatedFat;
    private Double protein;
    private String ingredients;
}
