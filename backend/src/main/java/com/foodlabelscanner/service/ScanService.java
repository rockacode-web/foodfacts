package com.foodlabelscanner.service;

import com.foodlabelscanner.dto.AlternativeProductDto;
import com.foodlabelscanner.dto.NutritionDataDto;
import com.foodlabelscanner.dto.RecipeDto;
import com.foodlabelscanner.dto.ScanResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScanService {
    private final OcrService ocrService;
    private final NutritionParserService nutritionParserService;
    private final NutritionAnalysisService nutritionAnalysisService;
    private final AlternativeRecommendationService alternativeRecommendationService;
    private final RecipeSuggestionService recipeSuggestionService;

    public ScanResponseDto analyzeScan(MultipartFile image) {
        String filename = image != null ? image.getOriginalFilename() : null;

        if (image == null || image.isEmpty()) {
            return new ScanResponseDto(
                    "No image content received.",
                    0,
                    "Unable to analyze because uploaded image is empty.",
                    filename,
                    "",
                    "Parsing incomplete: uploaded image is empty.",
                    List.of(),
                    new NutritionDataDto(),
                    List.of(),
                    List.of()
            );
        }

        boolean ocrAvailable = ocrService.isEngineAvailable();
        String rawOcrText = ocrService.extractText(image);
        NutritionDataDto parsedNutrition = nutritionParserService.parse(rawOcrText);
        List<String> warnings = nutritionAnalysisService.generateWarnings(parsedNutrition);
        List<AlternativeProductDto> alternatives =
                alternativeRecommendationService.recommend(parsedNutrition, warnings);
        List<RecipeDto> recipes = recipeSuggestionService.suggestRecipes(alternatives);
        Integer score = nutritionAnalysisService.calculateScore(parsedNutrition);
        String message;
        String parsingStatus;
        String explanation;

        if (!ocrAvailable) {
            message = "OCR engine unavailable: install Tesseract and add it to PATH.";
            parsingStatus = "Parsing incomplete: OCR could not run because Tesseract is not available.";
            explanation = "Install Tesseract OCR, restart backend, then rescan to extract nutrition values.";
        } else if (rawOcrText.isBlank()) {
            message = "Scan uploaded, but OCR text was not detected.";
            parsingStatus = "Parsing incomplete: OCR ran but no readable nutrition text was extracted.";
            explanation = nutritionAnalysisService.generateExplanation(parsedNutrition, warnings);
        } else {
            message = "Scan processed successfully.";
            parsingStatus = nutritionParserService.hasAnyDetectedField(parsedNutrition)
                    ? "Parsed nutrition fields detected from OCR text."
                    : "Parsing incomplete: no nutrition fields were detected from OCR text.";
            explanation = nutritionAnalysisService.generateExplanation(parsedNutrition, warnings);
        }

        return new ScanResponseDto(
                message,
                score,
                explanation,
                filename,
                rawOcrText,
                parsingStatus,
                warnings,
                parsedNutrition,
                alternatives,
                recipes
        );
    }
}
