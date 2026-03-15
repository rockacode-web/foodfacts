package com.foodlabelscanner.controller;

import com.foodlabelscanner.dto.ScanResponseDto;
import com.foodlabelscanner.service.ScanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/scans")
@RequiredArgsConstructor
public class ScanController {

    private final ScanService scanService;

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ScanResponseDto analyzeScan(
            @RequestParam("file") MultipartFile image
    ) {
        return scanService.analyzeScan(image);
    }

    @GetMapping("/test")
    public String test() {
        return "Backend is working!";
    }
}
