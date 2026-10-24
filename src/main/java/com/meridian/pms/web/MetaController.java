package com.meridian.pms.web;

import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.repository.ProductionRecordRepository;
import com.meridian.pms.repository.WellRepository;
import com.meridian.pms.web.dto.CommonDtos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/meta")
public class MetaController {

    private final WellRepository wellRepository;
    private final ProductionRecordRepository productionRepository;

    public MetaController(WellRepository wellRepository, ProductionRecordRepository productionRepository) {
        this.wellRepository = wellRepository;
        this.productionRepository = productionRepository;
    }

    @GetMapping
    public CommonDtos.MetaResponse meta() {
        Map<String, Long> statusCounts = new LinkedHashMap<>();
        Arrays.stream(WellStatus.values())
                .forEach(status -> statusCounts.put(status.name(), wellRepository.countByStatus(status)));
        return CommonDtos.MetaResponse.create(
                wellRepository.findDistinctFieldNames(),
                wellRepository.findDistinctOperators(),
                productionRepository.findLatestProductionDate(),
                statusCounts);
    }
}
