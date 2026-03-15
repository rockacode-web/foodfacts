package com.foodlabelscanner.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class OcrService {
    private static final Logger logger = LoggerFactory.getLogger(OcrService.class);
    private volatile Boolean tesseractAvailable;

    public boolean isEngineAvailable() {
        if (tesseractAvailable != null) {
            return tesseractAvailable;
        }

        synchronized (this) {
            if (tesseractAvailable != null) {
                return tesseractAvailable;
            }

            Process process = null;
            try {
                process = new ProcessBuilder("tesseract", "--version").start();
                boolean finished = process.waitFor(10, TimeUnit.SECONDS);
                tesseractAvailable = finished && process.exitValue() == 0;
            } catch (IOException | InterruptedException exception) {
                if (exception instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                tesseractAvailable = false;
            } finally {
                if (process != null) {
                    process.destroy();
                }
            }
        }

        return tesseractAvailable;
    }

    public String extractText(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return "";
        }

        Path tempImage = null;
        try {
            tempImage = Files.createTempFile("foodfacts-scan-", getFileSuffix(image));
            image.transferTo(tempImage);
            logger.debug("OCR temp image path: {}", tempImage.toAbsolutePath());

            String cliText = extractWithTesseractCli(tempImage);
            return normalize(cliText);
        } catch (IOException exception) {
            return "";
        } finally {
            if (tempImage != null) {
                try {
                    Files.deleteIfExists(tempImage);
                } catch (IOException ignored) {
                    // no-op cleanup fallback
                }
            }
        }
    }

    private String extractWithTesseractCli(Path imagePath) {
        if (!isEngineAvailable()) {
            return "";
        }

        Process process = null;
        try {
            List<String> command = Arrays.asList(
                    "tesseract",
                    imagePath.toAbsolutePath().toString(),
                    "stdout",
                    "-l",
                    "eng"
            );
            logger.debug("OCR command: {}", String.join(" ", command));
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.redirectErrorStream(false);
            process = processBuilder.start();

            CompletableFuture<String> stdoutFuture = readStreamAsync(process.getInputStream());
            CompletableFuture<String> stderrFuture = readStreamAsync(process.getErrorStream());

            boolean finished = process.waitFor(45, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                logger.warn("Tesseract timed out for image: {}", imagePath.toAbsolutePath());
                return "";
            }

            String stdoutText = stdoutFuture.join();
            String stderrText = stderrFuture.join();
            logger.debug("OCR stdout length: {}", stdoutText.length());
            if (!stderrText.isBlank()) {
                logger.debug("OCR stderr diagnostics: {}", summarizeForLog(stderrText));
            }

            if (process.exitValue() != 0) {
                logger.warn(
                        "Tesseract exited with code {}. Diagnostics: {}",
                        process.exitValue(),
                        summarizeForLog(stderrText)
                );
                return "";
            }

            if (stdoutText.isBlank()) {
                if (!stderrText.isBlank()) {
                    logger.warn("OCR produced no recognized text. Diagnostics: {}", summarizeForLog(stderrText));
                } else {
                    logger.warn("OCR produced no recognized text and no diagnostics.");
                }
                return "";
            }

            return stdoutText;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return "";
        } catch (IOException exception) {
            return "";
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
    }

    private CompletableFuture<String> readStreamAsync(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try (InputStream source = stream) {
                return new String(source.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException exception) {
                return "";
            }
        });
    }

    private String summarizeForLog(String text) {
        String normalized = normalize(text);
        if (normalized.length() <= 500) {
            return normalized;
        }
        return normalized.substring(0, 500) + "...";
    }

    private String getFileSuffix(MultipartFile image) {
        String originalFilename = image.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return ".img";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            return ".img";
        }
        return originalFilename.substring(dotIndex).toLowerCase(Locale.ROOT);
    }

    private String normalize(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\r", "").trim();
    }
}
