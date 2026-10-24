package com.meridian.pms.web;

import com.meridian.pms.service.DashboardService;
import com.meridian.pms.web.dto.DashboardDtos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public DashboardDtos.DashboardResponse summary(@RequestParam(defaultValue = "30") int days) {
        return dashboardService.summary(days);
    }
}
