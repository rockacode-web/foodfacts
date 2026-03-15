package com.foodlabelscanner.service;

import com.foodlabelscanner.dto.NutritionDataDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NutritionParserService {
    private static final Logger logger = LoggerFactory.getLogger(NutritionParserService.class);

    private static final Pattern MULTI_SPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern LEADING_JUNK_PATTERN = Pattern.compile("^[\\s\\]\\[\\(\\){}|`~*_:=;.,!]+");
    private static final Pattern TRAILING_JUNK_PATTERN = Pattern.compile("[\\s\\]\\[\\(\\){}|`~*_:=;.,!]+$");

    private static final Pattern CALORIES_LABEL_PATTERN = Pattern.compile("(?i)\\bcalories?\\b");
    private static final Pattern SUGAR_LABEL_PATTERN = Pattern.compile("(?i)\\b(?:total\\s+)?sugars?\\b");
    private static final Pattern SODIUM_LABEL_PATTERN = Pattern.compile("(?i)\\bsodium\\b");
    private static final Pattern SATURATED_FAT_LABEL_PATTERN = Pattern.compile("(?i)\\bsaturated\\s+fat\\b");
    private static final Pattern PROTEIN_LABEL_PATTERN = Pattern.compile("(?i)\\bprotein\\b");
    private static final Pattern INGREDIENTS_LABEL_PATTERN =
            Pattern.compile("(?i)\\bingred(?:i|l|1)ents?\\b\\s*[:\\-]?\\s*(.*)$");

    private static final Pattern AMOUNT_TOKEN_PATTERN =
            Pattern.compile("(<\\s*)?(\\d{1,6}(?:[.,]\\d{1,2})?)\\s*(mg|g)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern PERCENT_PATTERN = Pattern.compile("\\b\\d{1,3}\\s*%");

    private static final Pattern SECTION_HEADER_PATTERN = Pattern.compile(
            "(?i)^(nutrition\\s+facts|serving\\s+size|amount\\s+per\\s+serving|%\\s*daily\\s+value|"
                    + "calories|sodium|protein|(?:total\\s+)?sugars?|saturated\\s+fat|"
                    + "cholesterol|total\\s+fat|trans\\s+fat|carbohydrate|dietary\\s+fiber|"
                    + "vitamin\\b|iron\\b|potassium\\b)\\b"
    );

    public NutritionDataDto parse(String rawOcrText) {
        NutritionDataDto nutritionData = new NutritionDataDto();

        if (rawOcrText == null || rawOcrText.isBlank()) {
            return nutritionData;
        }

        List<String> normalizedLines = normalizeLines(rawOcrText);
        debugLines(normalizedLines);

        nutritionData.setCalories(parseField(normalizedLines, CALORIES_LABEL_PATTERN, FieldType.CALORIES));
        nutritionData.setSugar(parseField(normalizedLines, SUGAR_LABEL_PATTERN, FieldType.SUGAR));
        nutritionData.setSodium(parseField(normalizedLines, SODIUM_LABEL_PATTERN, FieldType.SODIUM));
        nutritionData.setSaturatedFat(parseField(normalizedLines, SATURATED_FAT_LABEL_PATTERN, FieldType.SATURATED_FAT));
        nutritionData.setProtein(parseField(normalizedLines, PROTEIN_LABEL_PATTERN, FieldType.PROTEIN));
        nutritionData.setIngredients(extractIngredients(normalizedLines));

        return nutritionData;
    }

    public boolean hasAnyDetectedField(NutritionDataDto nutritionData) {
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

    private List<String> normalizeLines(String rawOcrText) {
        String[] split = rawOcrText.replace("\r", "\n").split("\n");
        List<String> lines = new ArrayList<>();

        for (String rawLine : split) {
            String normalized = normalizeLine(rawLine);
            if (!normalized.isBlank()) {
                lines.add(normalized);
            }
        }

        return lines;
    }

    private String normalizeLine(String line) {
        if (line == null) {
            return "";
        }

        String normalized = line
                .replace('\u2018', '\'')
                .replace('\u2019', '\'')
                .replace('\u201C', '"')
                .replace('\u201D', '"')
                .replace('\u2032', '\'')
                .replace('\u2033', '"');

        normalized = normalized.trim();
        normalized = MULTI_SPACE_PATTERN.matcher(normalized).replaceAll(" ");
        normalized = LEADING_JUNK_PATTERN.matcher(normalized).replaceAll("");
        normalized = TRAILING_JUNK_PATTERN.matcher(normalized).replaceAll("");

        return normalized.trim();
    }

    private void debugLines(List<String> lines) {
        if (!logger.isDebugEnabled()) {
            return;
        }

        for (int i = 0; i < lines.size(); i++) {
            logger.debug("OCR line [{}]: {}", i, lines.get(i));
        }
    }

    private Double parseField(List<String> lines, Pattern labelPattern, FieldType fieldType) {
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            Matcher labelMatcher = labelPattern.matcher(line);
            if (!labelMatcher.find()) {
                continue;
            }

            int labelEnd = labelMatcher.end();
            Optional<AmountParseResult> amountResult = extractAmountWithUnit(line, labelEnd, fieldType);
            if (amountResult.isEmpty()) {
                logger.debug("No confident {} value found from line [{}]: {}", fieldType.logName, i, line);
                continue;
            }

            AmountParseResult parsed = amountResult.get();
            logger.debug(
                    "Parsed {} from line [{}]: token='{}', value={}",
                    fieldType.logName,
                    i,
                    parsed.rawToken,
                    parsed.value
            );
            return parsed.value;
        }

        return null;
    }

    private Optional<AmountParseResult> extractAmountWithUnit(String line, int labelEnd, FieldType fieldType) {
        String tail = line.substring(Math.min(labelEnd, line.length()));
        List<AmountToken> tokens = extractAmountTokens(tail);
        if (tokens.isEmpty()) {
            return Optional.empty();
        }

        AmountToken preferred = pickBestToken(tokens, fieldType);
        if (preferred == null) {
            return Optional.empty();
        }

        Double baseValue = preferred.numericValue;
        if (baseValue == null) {
            return Optional.empty();
        }

        Double convertedValue = convertToExpectedUnit(baseValue, preferred.unit, fieldType.expectedUnit);
        if (convertedValue == null) {
            return Optional.empty();
        }

        Double recoveredValue = recoverLikelyValue(fieldType, convertedValue, preferred, line);
        if (recoveredValue == null || !isPlausible(fieldType, recoveredValue)) {
            return Optional.empty();
        }

        return Optional.of(new AmountParseResult(recoveredValue, preferred.rawToken));
    }

    private List<AmountToken> extractAmountTokens(String tail) {
        List<AmountToken> tokens = new ArrayList<>();
        Matcher matcher = AMOUNT_TOKEN_PATTERN.matcher(tail);

        while (matcher.find()) {
            String numberText = matcher.group(2);
            Double numericValue = parseNumber(numberText);
            if (numericValue == null) {
                continue;
            }

            String unit = matcher.group(3);
            String normalizedUnit = unit == null ? null : unit.toLowerCase(Locale.ROOT);
            boolean lessThan = matcher.group(1) != null;
            boolean percentToken = isPercentToken(tail, matcher.end());
            double adjustedValue = lessThan ? Math.min(numericValue, 1.0) : numericValue;

            String digitsOnly = numberText.replaceAll("[^0-9]", "");
            tokens.add(new AmountToken(
                    matcher.group().trim(),
                    digitsOnly,
                    adjustedValue,
                    normalizedUnit,
                    percentToken
            ));
        }

        return tokens;
    }

    private boolean isPercentToken(String tail, int tokenEnd) {
        int idx = tokenEnd;
        while (idx < tail.length() && Character.isWhitespace(tail.charAt(idx))) {
            idx++;
        }
        return idx < tail.length() && tail.charAt(idx) == '%';
    }

    private AmountToken pickBestToken(List<AmountToken> tokens, FieldType fieldType) {
        AmountToken preferred = firstMatchingToken(tokens, token -> !token.percentToken
                && fieldType.expectedUnit != null
                && fieldType.expectedUnit.equals(token.unit));
        if (preferred != null) {
            return preferred;
        }

        preferred = firstMatchingToken(tokens, token -> !token.percentToken && token.unit != null);
        if (preferred != null) {
            return preferred;
        }

        return firstMatchingToken(tokens, token -> !token.percentToken);
    }

    private AmountToken firstMatchingToken(List<AmountToken> tokens, TokenPredicate predicate) {
        for (AmountToken token : tokens) {
            if (predicate.test(token)) {
                return token;
            }
        }
        return null;
    }

    private Double recoverLikelyValue(FieldType fieldType, Double value, AmountToken token, String line) {
        if (value == null) {
            return null;
        }

        if (fieldType == FieldType.SODIUM) {
            return recoverSodiumValue(value, token, line);
        }

        if (fieldType == FieldType.PROTEIN) {
            return recoverProteinValue(value, token);
        }

        if (fieldType == FieldType.SATURATED_FAT) {
            return recoverLeadingValueWhenNoUnit(value, token, 20);
        }

        if (fieldType == FieldType.SUGAR) {
            return recoverLeadingValueWhenNoUnit(value, token, 60);
        }

        if (fieldType == FieldType.CALORIES) {
            return recoverLeadingValueWhenNoUnit(value, token, 1000);
        }

        return value;
    }

    private Double recoverSodiumValue(Double currentValue, AmountToken token, String line) {
        if (isPlausible(FieldType.SODIUM, currentValue)) {
            return currentValue;
        }

        if (token.unit == null && token.digitsOnly.length() >= 5 && containsPercent(line)) {
            Integer recovered = recoverLeadingDigits(token.digitsOnly, 2, 4, 40, 2000);
            if (recovered != null) {
                return recovered.doubleValue();
            }
        }

        return currentValue;
    }

    private Double recoverProteinValue(Double currentValue, AmountToken token) {
        if (isPlausible(FieldType.PROTEIN, currentValue)) {
            return currentValue;
        }

        if (token.unit == null && token.digitsOnly.length() == 3) {
            Integer leadingTwo = safeParseInt(token.digitsOnly.substring(0, 2));
            if (leadingTwo != null && leadingTwo <= 60) {
                return leadingTwo.doubleValue();
            }

            Integer leadingOne = safeParseInt(token.digitsOnly.substring(0, 1));
            if (leadingOne != null && leadingOne <= 60) {
                return leadingOne.doubleValue();
            }
        }

        return currentValue;
    }

    private Double recoverLeadingValueWhenNoUnit(Double currentValue, AmountToken token, double maxExpected) {
        if (isPlausibleByRange(currentValue, 0, maxExpected)) {
            return currentValue;
        }

        if (token.unit == null && token.digitsOnly.length() >= 3) {
            Integer recovered = recoverLeadingDigits(token.digitsOnly, 1, 3, 0, (int) maxExpected);
            if (recovered != null) {
                return recovered.doubleValue();
            }
        }

        return currentValue;
    }

    private Integer recoverLeadingDigits(String digits, int minLength, int maxLength, int minValue, int maxValue) {
        int upper = Math.min(maxLength, digits.length());
        for (int len = upper; len >= minLength; len--) {
            Integer candidate = safeParseInt(digits.substring(0, len));
            if (candidate == null) {
                continue;
            }
            if (candidate >= minValue && candidate <= maxValue) {
                return candidate;
            }
        }
        return null;
    }

    private Double convertToExpectedUnit(Double value, String fromUnit, String expectedUnit) {
        if (value == null) {
            return null;
        }
        if (expectedUnit == null) {
            return value;
        }

        String normalizedFrom = fromUnit == null ? expectedUnit : fromUnit;
        if (normalizedFrom.equals(expectedUnit)) {
            return value;
        }
        if (normalizedFrom.equals("mg") && expectedUnit.equals("g")) {
            return value / 1000.0;
        }
        if (normalizedFrom.equals("g") && expectedUnit.equals("mg")) {
            return value * 1000.0;
        }

        return null;
    }

    private Double parseNumber(String numberText) {
        if (numberText == null) {
            return null;
        }

        String normalized = numberText.replace(',', '.').trim();
        try {
            return Double.parseDouble(normalized);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private boolean containsPercent(String line) {
        return PERCENT_PATTERN.matcher(line).find();
    }

    private boolean isPlausible(FieldType fieldType, Double value) {
        if (value == null) {
            return false;
        }

        return switch (fieldType) {
            case CALORIES -> isPlausibleByRange(value, 0, 1000);
            case SODIUM -> isPlausibleByRange(value, 0, 2500);
            case PROTEIN -> isPlausibleByRange(value, 0, 60);
            case SUGAR -> isPlausibleByRange(value, 0, 60);
            case SATURATED_FAT -> isPlausibleByRange(value, 0, 20);
        };
    }

    private boolean isPlausibleByRange(Double value, double min, double max) {
        return value != null && value >= min && value <= max;
    }

    private Integer safeParseInt(String valueText) {
        try {
            return Integer.parseInt(valueText);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String extractIngredients(List<String> lines) {
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            Matcher matcher = INGREDIENTS_LABEL_PATTERN.matcher(line);
            if (!matcher.find()) {
                continue;
            }

            StringBuilder ingredients = new StringBuilder();
            String firstSegment = matcher.group(1) == null ? "" : matcher.group(1).trim();
            if (!firstSegment.isBlank()) {
                ingredients.append(firstSegment);
            }

            for (int j = i + 1; j < lines.size(); j++) {
                String continuation = lines.get(j);
                if (continuation.isBlank() || isLikelyNewSection(continuation)) {
                    break;
                }
                if (ingredients.length() > 0) {
                    ingredients.append(" ");
                }
                ingredients.append(continuation);
            }

            String extracted = ingredients.toString().trim();
            if (!extracted.isBlank()) {
                logger.debug("Parsed ingredients from line [{}]: {}", i, extracted);
                return extracted;
            }
            break;
        }

        return null;
    }

    private boolean isLikelyNewSection(String line) {
        if (line == null || line.isBlank()) {
            return true;
        }

        return SECTION_HEADER_PATTERN.matcher(line).find();
    }

    private interface TokenPredicate {
        boolean test(AmountToken token);
    }

    private enum FieldType {
        CALORIES("calories", null),
        SUGAR("sugar", "g"),
        SODIUM("sodium", "mg"),
        SATURATED_FAT("saturated fat", "g"),
        PROTEIN("protein", "g");

        private final String logName;
        private final String expectedUnit;

        FieldType(String logName, String expectedUnit) {
            this.logName = logName;
            this.expectedUnit = expectedUnit;
        }
    }

    private static class AmountToken {
        private final String rawToken;
        private final String digitsOnly;
        private final Double numericValue;
        private final String unit;
        private final boolean percentToken;

        private AmountToken(
                String rawToken,
                String digitsOnly,
                Double numericValue,
                String unit,
                boolean percentToken
        ) {
            this.rawToken = rawToken;
            this.digitsOnly = digitsOnly;
            this.numericValue = numericValue;
            this.unit = unit;
            this.percentToken = percentToken;
        }
    }

    private static class AmountParseResult {
        private final Double value;
        private final String rawToken;

        private AmountParseResult(Double value, String rawToken) {
            this.value = value;
            this.rawToken = rawToken;
        }
    }
}
