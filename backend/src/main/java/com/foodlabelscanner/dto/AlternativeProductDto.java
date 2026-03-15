package com.foodlabelscanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AlternativeProductDto {
    private String name;
    private String reason;
    private String category;
}
