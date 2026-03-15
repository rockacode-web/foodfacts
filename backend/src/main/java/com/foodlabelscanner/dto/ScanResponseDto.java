package com.foodlabelscanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ScanResponseDto {
    private String message;
    private Integer score;
    private String explanation;
    private String filename;
    private String rawOcrText;
    private String parsingStatus;
    private List<String> warnings;
    private NutritionDataDto nutrition;
    private List<AlternativeProductDto> alternatives;
    private List<RecipeDto> recipes;
}
