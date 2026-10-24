package com.meridian.pms.web;

import com.meridian.pms.domain.DowntimeCategory;
import com.meridian.pms.service.DowntimeService;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.DowntimeDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/downtime")
public class DowntimeController {

    private final DowntimeService downtimeService;

    public DowntimeController(DowntimeService downtimeService) {
        this.downtimeService = downtimeService;
    }

    @GetMapping
    public CommonDtos.PageResponse<DowntimeDtos.DowntimeView> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) DowntimeCategory category,
            @RequestParam(required = false) Long wellId,
            @RequestParam(required = false) String field,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return downtimeService.list(status, category, wellId, field, page, size);
    }

    @GetMapping("/summary")
    public DowntimeDtos.DowntimeSummary summary(@RequestParam(defaultValue = "90") int days) {
        return downtimeService.summary(days);
    }

    @GetMapping("/{id}")
    public DowntimeDtos.DowntimeView get(@PathVariable Long id) {
        return downtimeService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DowntimeDtos.DowntimeView create(@Valid @RequestBody DowntimeDtos.DowntimeUpsertRequest request) {
        return downtimeService.create(request);
    }

    @PutMapping("/{id}")
    public DowntimeDtos.DowntimeView update(@PathVariable Long id,
                                            @Valid @RequestBody DowntimeDtos.DowntimeUpsertRequest request) {
        return downtimeService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        downtimeService.delete(id);
    }
}
