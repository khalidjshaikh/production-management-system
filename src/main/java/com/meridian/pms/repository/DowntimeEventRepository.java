package com.meridian.pms.repository;

import com.meridian.pms.domain.DowntimeEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface DowntimeEventRepository extends JpaRepository<DowntimeEvent, Long>, JpaSpecificationExecutor<DowntimeEvent> {

    void deleteByWellId(Long wellId);

    long countByEndTimeIsNull();

    @Query("""
            select d from DowntimeEvent d
            join fetch d.well
            where d.endTime is null or d.endTime >= :from
            order by d.startTime desc
            """)
    List<DowntimeEvent> findRelevantSince(@Param("from") LocalDateTime from);

    @Query("""
            select d from DowntimeEvent d
            join fetch d.well
            where d.well.id = :wellId
            order by d.startTime desc
            """)
    List<DowntimeEvent> findForWell(@Param("wellId") Long wellId);

    @Query("""
            select d from DowntimeEvent d
            join fetch d.well
            order by d.startTime desc
            """)
    List<DowntimeEvent> findRecent();

    @Query("select coalesce(sum(d.deferredOilBbl), 0) from DowntimeEvent d where d.startTime >= :from")
    Double sumDeferredOilSince(@Param("from") LocalDateTime from);

    @Query("select coalesce(sum(d.deferredGasMcf), 0) from DowntimeEvent d where d.startTime >= :from")
    Double sumDeferredGasSince(@Param("from") LocalDateTime from);

    @Query("""
            select coalesce(sum(d.deferredOilBbl), 0) from DowntimeEvent d
            where d.startTime between :from and :to
            """)
    Double sumDeferredOilBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select coalesce(sum(d.deferredGasMcf), 0) from DowntimeEvent d
            where d.startTime between :from and :to
            """)
    Double sumDeferredGasBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
