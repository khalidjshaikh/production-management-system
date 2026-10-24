package com.meridian.pms.web;

import com.meridian.pms.service.ForecastService;
import com.meridian.pms.web.dto.ForecastDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/forecasts")
public class ForecastController {

    private final ForecastService forecastService;

    public ForecastController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    @GetMapping
    public List<ForecastDtos.ForecastSummary> list() {
        return forecastService.list();
    }

    @GetMapping("/{id}")
    public ForecastDtos.ForecastDetail get(@PathVariable Long id) {
        return forecastService.get(id);
    }

    @GetMapping("/well/{wellId}")
    public List<ForecastDtos.ForecastSummary> forWell(@PathVariable Long wellId) {
        return forecastService.forWell(wellId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ForecastDtos.ForecastDetail generate(@Valid @RequestBody ForecastDtos.GenerateForecastRequest request) {
        return forecastService.generate(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        forecastService.delete(id);
    }
}
