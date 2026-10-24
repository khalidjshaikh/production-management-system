package com.meridian.pms.repository;

import com.meridian.pms.domain.Well;
import com.meridian.pms.domain.WellStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface WellRepository extends JpaRepository<Well, Long>, JpaSpecificationExecutor<Well> {

    Optional<Well> findByApiNumberIgnoreCase(String apiNumber);

    boolean existsByApiNumberIgnoreCase(String apiNumber);

    boolean existsByApiNumberIgnoreCaseAndIdNot(String apiNumber, Long id);

    long countByStatus(WellStatus status);

    @Query("select distinct w.fieldName from Well w order by w.fieldName")
    List<String> findDistinctFieldNames();

    @Query("select distinct w.operator from Well w order by w.operator")
    List<String> findDistinctOperators();
}
