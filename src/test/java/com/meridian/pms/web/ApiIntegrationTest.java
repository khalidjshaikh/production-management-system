package com.meridian.pms.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = {
        "app.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:meridian-test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsAWellAndExposesItThroughTheListApi() throws Exception {
        String request = """
                {
                  "name": "Integration Test 1H",
                  "apiNumber": "42-999-90001",
                  "fieldName": "Test Field",
                  "operator": "Meridian Operating",
                  "status": "PRODUCING",
                  "liftType": "ESP",
                  "county": "Midland",
                  "state": "TX"
                }
                """;

        mockMvc.perform(post("/api/wells")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Integration Test 1H"))
                .andExpect(jsonPath("$.apiNumber").value("42-999-90001"))
                .andExpect(jsonPath("$.statusLabel").value("Producing"));

        mockMvc.perform(get("/api/wells").param("search", "Integration Test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].fieldName").value("Test Field"));
    }

    @Test
    void returnsFieldLevelValidationErrors() throws Exception {
        String request = """
                {
                  "name": "",
                  "apiNumber": "x",
                  "fieldName": "Test Field",
                  "operator": "Meridian Operating",
                  "status": "PRODUCING"
                }
                """;

        mockMvc.perform(post("/api/wells")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.apiNumber").exists());
    }

    @Test
    void exposesMetadataAndEmptyForecastList() throws Exception {
        mockMvc.perform(get("/api/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wellStatuses").isArray())
                .andExpect(jsonPath("$.statusCounts.PRODUCING").value(0));

        mockMvc.perform(get("/api/forecasts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }
}
