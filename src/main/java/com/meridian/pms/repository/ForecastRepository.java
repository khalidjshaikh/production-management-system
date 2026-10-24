package com.meridian.pms.repository;

import com.meridian.pms.domain.Forecast;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ForecastRepository extends JpaRepository<Forecast, Long> {

    @EntityGraph(attributePaths = {"well", "points"})
    List<Forecast> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"well", "points"})
    @Query("select f from Forecast f where f.id = :id")
    Optional<Forecast> findDetailedById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"well", "points"})
    List<Forecast> findByWellIdOrderByCreatedAtDesc(Long wellId);

    void deleteByWellId(Long wellId);

    long countByWellId(Long wellId);
}
