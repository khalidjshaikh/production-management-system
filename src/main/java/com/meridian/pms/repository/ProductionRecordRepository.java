package com.meridian.pms.repository;

import com.meridian.pms.domain.ProductionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProductionRecordRepository extends JpaRepository<ProductionRecord, Long>, JpaSpecificationExecutor<ProductionRecord> {

    Optional<ProductionRecord> findByWellIdAndProductionDate(Long wellId, LocalDate productionDate);

    long countByWellId(Long wellId);

    void deleteByWellId(Long wellId);

    @Query("select max(p.productionDate) from ProductionRecord p")
    LocalDate findLatestProductionDate();

    @Query("select max(p.productionDate) from ProductionRecord p where p.well.id = :wellId")
    LocalDate findLatestProductionDateByWellId(@Param("wellId") Long wellId);

    @Query("""
            select p.productionDate as date,
                   sum(p.oilBbl) as oil,
                   sum(p.gasMcf) as gas,
                   sum(p.waterBbl) as water,
                   sum(p.hoursOnline) as hours,
                   count(p) as records
            from ProductionRecord p
            join p.well w
            where p.productionDate between :from and :to
              and (:wellId is null or w.id = :wellId)
              and (:field is null or w.fieldName = :field)
            group by p.productionDate
            order by p.productionDate
            """)
    List<DailyAggregate> aggregateDaily(@Param("from") LocalDate from,
                                        @Param("to") LocalDate to,
                                        @Param("wellId") Long wellId,
                                        @Param("field") String field);

    @Query("""
            select w.id as wellId,
                   sum(p.oilBbl) as oil,
                   sum(p.gasMcf) as gas,
                   sum(p.waterBbl) as water,
                   sum(p.hoursOnline) as hours,
                   count(p) as records
            from ProductionRecord p
            join p.well w
            where p.productionDate between :from and :to
            group by w.id
            """)
    List<WellAggregate> aggregateByWell(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select w.fieldName as field,
                   sum(p.oilBbl) as oil,
                   sum(p.gasMcf) as gas,
                   sum(p.waterBbl) as water,
                   count(distinct w.id) as wells
            from ProductionRecord p
            join p.well w
            where p.productionDate between :from and :to
            group by w.fieldName
            order by sum(p.oilBbl) desc
            """)
    List<FieldAggregate> aggregateByField(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select p from ProductionRecord p
            join fetch p.well w
            where w.id = :wellId and p.productionDate between :from and :to
            order by p.productionDate
            """)
    List<ProductionRecord> findForWellBetween(@Param("wellId") Long wellId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to);

    @Query("""
            select p from ProductionRecord p
            join fetch p.well w
            where p.productionDate between :from and :to
            order by p.productionDate
            """)
    List<ProductionRecord> findAllBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    interface DailyAggregate {
        LocalDate getDate();

        Double getOil();

        Double getGas();

        Double getWater();

        Double getHours();

        Long getRecords();
    }

    interface WellAggregate {
        Long getWellId();

        Double getOil();

        Double getGas();

        Double getWater();

        Double getHours();

        Long getRecords();
    }

    interface FieldAggregate {
        String getField();

        Double getOil();

        Double getGas();

        Double getWater();

        Long getWells();
    }
}
