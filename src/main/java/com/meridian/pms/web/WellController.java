package com.meridian.pms.web;

import com.meridian.pms.domain.LiftType;
import com.meridian.pms.domain.WellStatus;
import com.meridian.pms.service.WellService;
import com.meridian.pms.web.dto.CommonDtos;
import com.meridian.pms.web.dto.WellDtos;
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
@RequestMapping("/api/wells")
public class WellController {

    private final WellService wellService;

    public WellController(WellService wellService) {
        this.wellService = wellService;
    }

    @GetMapping
    public CommonDtos.PageResponse<WellDtos.WellView> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) WellStatus status,
            @RequestParam(required = false) String field,
            @RequestParam(required = false) LiftType liftType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String sort) {
        return wellService.list(search, status, field, liftType, page, size, sort);
    }

    @GetMapping("/{id}")
    public WellDtos.WellDetail get(@PathVariable Long id) {
        return wellService.getDetail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WellDtos.WellView create(@Valid @RequestBody WellDtos.WellUpsertRequest request) {
        return wellService.create(request);
    }

    @PutMapping("/{id}")
    public WellDtos.WellView update(@PathVariable Long id, @Valid @RequestBody WellDtos.WellUpsertRequest request) {
        return wellService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        wellService.delete(id);
    }
}
