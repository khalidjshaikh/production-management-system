# Meridian — Production Management System

**Project statement:** Delivered Meridian, a full-stack oil & gas production management system built with Java 27, Spring Boot 4.2.0-M2, H2 2.5.252, React 19.3.1, TypeScript 7, and Vite 8, covering well surveillance, daily allocation, downtime accounting, decline-curve forecasting, and a responsive operations console.

## Platform & Architecture

- Architected a single-deployable full-stack system pairing a Spring Boot REST backend with a React/Vite SPA bundled into one executable jar.
- Chose Java 27 and Spring MVC (`spring-boot-starter-webmvc`) with clear layers for domain, repositories, services, web DTOs, controllers, configuration, and error handling.
- Modeled oil and gas operations end-to-end across wells, daily production, downtime events, and Arps decline forecasts behind one API-backed operations console.
- Configured Spring Data JPA with file-backed H2 2.5.252 and `ddl-auto=update` for zero-setup, restart-safe local persistence.
- Enabled Tomcat to bind a dual-stack wildcard socket, making the UI and API reachable at both `http://127.0.0.1:8090` and `http://[::1]:8090`.
- Applied class-level `@Transactional(readOnly = true)` service boundaries with write-scoped overrides for CRUD and forecast generation.
- Exposed Spring Boot Actuator health and info endpoints while limiting the public management surface.
- Kept the SPA origin-agnostic with relative `/api` calls and CORS restricted to hostname, IPv4, and IPv6 loopback development origins.

## Backend & REST API

- Implemented 22 REST operations across six controllers for dashboard, wells, production, downtime, forecasts, and metadata.
- Built `/api/dashboard` to return range-based KPIs, previous-period deltas, daily series, field mix, top producers, recent downtime, a six-month outlook, and recent production entries.
- Delivered paginated, filterable well listing with free-text search, status, field, lift type, sorting, page, and size parameters.
- Exposed a well-360 response combining well attributes, 30-day performance metrics, a 180-day daily series, and recent downtime history.
- Returned production ledger pages together with full-range summary metrics and a daily chart series in a single response.
- Added downtime list, detail, create, update, delete, and `/summary` endpoints for reason and reliability analysis.
- Added forecast list, detail, per-well lookup, generation, and deletion endpoints with actual-versus-forecast context.
- Modeled request contracts as Java records with Bean Validation for API-number patterns, numeric ranges, enum requirements, dates, and text lengths.
- Centralized RFC 9457 `ProblemDetail` responses for 400, 404, 409, and 500 outcomes, including field-level validation maps.
- Mapped `NoResourceFoundException` to a clean 404 so unknown static and API paths do not surface as internal server errors.
- Implemented SPA deep-link forwarding for `/wells/**`, `/production`, `/downtime`, and `/forecast/**` while preserving API and asset routing.
- Bound query parameters and enums for dashboard ranges, well statuses, lift types, downtime categories, and forecast models with type-mismatch handling.

## Domain Model & Persistence

- Designed five JPA entities: `Well`, `ProductionRecord`, `DowntimeEvent`, `Forecast`, and `ForecastPoint`, with explicit table and relationship mappings.
- Enforced uniqueness on well API numbers and on the `(well_id, production_date)` pair for daily production records.
- Added production indexes on date and well/date plus downtime indexes on start time and well to support surveillance queries.
- Modeled well lifecycle with `PRODUCING`, `SHUT_IN`, `COMPLETING`, `DRILLING`, and `PLUGGED` statuses and display labels.
- Modeled artificial lift through ESP, rod pump, gas lift, plunger lift, hydraulic, and natural-flow enum values.
- Captured oil bbl, gas Mcf, water bbl, hours online, wellhead pressure, choke size, and operational notes per production day.
- Calculated water cut in the domain layer as water divided by total liquids for consistent downstream metrics.
- Persisted forecast parameters including qi, annual decline, b-factor, horizon, economic limit, GOR, water cut, EUR, and R².
- Used `@EntityGraph` on forecast queries to fetch wells and monthly points eagerly and avoid N+1 query patterns.

## Production & Well Analytics

- Computed 30-day oil, gas, and water rates plus water cut, uptime, and prior-period oil change for every well.
- Derived uptime from reported hours online divided by available hours on reporting days and tracked reporting-day counts.
- Filled dashboard series day-by-day with zeroes for missing dates to keep charts and KPI aggregations continuous.
- Implemented previous-window comparisons for oil, gas, water cut, uptime, and deferred oil to produce KPI deltas.
- Built field-level oil, gas, and water aggregates with well counts, water cut, and oil-rate share percentages.
- Ranked top producers with field, lift type, status, water cut, uptime, period delta, and oil-share context.
- Aggregated the latest forecast per well into six monthly outlook buckets for field-level oil and gas projections.
- Added production filtering by well, field, and date window with a default 90-day range and a two-year cap.
- Rejected future production dates and duplicate well/day records with explicit 400 and 409 responses.
- Supported production record editing and deletion with transactional writes and page-aware UI refresh behavior.

## Downtime & Deferment

- Distinguished active and resolved downtime using nullable end timestamps and computed live duration from start to now.
- Generated weighted random downtime patterns spanning maintenance, equipment failure, power, weather, pipeline, regulatory, and other reasons.
- Auto-estimated deferred oil and gas from each well's 30-day pre-event average rate and event duration when values were omitted.
- Computed reliability KPIs for total and active events, downtime hours, deferred volumes, average resolution time, and reason slices.
- Built daily downtime series by measuring interval overlap between every event and each day in the reporting window.
- Added downtime CRUD validation for well, description, and chronological start/end timestamps.
- Supported active-event resolution through the editor by pre-filling the end timestamp while preserving deferment values.
- Rendered reason-coded event timelines with duration chips, reporter attribution, and deferred oil/gas stacks.

## Forecasting & Decline-Curve Engineering

- Implemented Arps exponential decline fitting through log-linear regression over up to 18 months of monthly oil rates.
- Implemented hyperbolic decline fitting through grid search over b-factor (0.1–1.2) and qi multipliers (0.75–1.25) with analytical decline solving.
- Validated minimum history of 60 daily records and four producing months before permitting a forecast.
- Aggregated daily records into monthly rates while filtering zero-rate months and preserving month offsets.
- Reported model quality as R² and annual effective decline percentage for every fit.
- Projected P50 oil from the month after the latest production date using configurable horizon and economic limit.
- Generated P10/P90 bands with 0.88/1.10 qi factors and 1.25/0.80 decline multipliers while preserving low ≤ P50 ≤ high ordering.
- Derived gas rates from recent gas-oil ratio and water rates from a capped water-cut trend.
- Estimated remaining recoverable oil by integrating monthly rates to the economic limit with a 600-month cap.
- Persisted monthly forecast points with P50, P10, P90, gas, water, and cumulative oil values.
- Returned 12 months of actual monthly oil rates alongside forecast points for visual backtesting.
- Exposed exponential/hyperbolic model selection and optional b-factor control through API and UI.

## Frontend Engineering

- Built a React 19.3.1 and TypeScript 7 single-page application using React Router 7 for eight routes.
- Created a typed fetch client with generic request helpers, query-string construction, `ApiError` field extraction, and abort signals.
- Implemented `useApi` and `useDebouncedValue` hooks for request lifecycle, refetching, loading state, and debounced search.
- Added a `MetaProvider` that loads fields, operators, enum labels, latest production date, and status counts once for all pages.
- Built a toast provider with timed success/error/info messages and an accessible live region.
- Implemented modal focus trapping, Escape dismissal, focus restoration, overlay dismissal, and body scroll locking.
- Added reusable form fields, client validation, numeric suffix inputs, derived read-only previews, and server error mapping across four editors.
- Built a responsive shell with collapsible mobile navigation, breadcrumb context, asset summary, data-status footer, and sticky top bar.
- Added range controls, search/filter/sort toolbars, pagination, empty states, and detail-page back links.
- Supported query-driven deep links for opening production, downtime, and forecast editors from dashboard and well-detail actions.
- Implemented server-backed CRUD flows with refresh after saves and confirmation dialogs before destructive actions.
- Configured an IPv6-aware Vite dev server with `/api` and `/actuator` proxying and hot reload.

## Data Visualization & UI System

- Built a Recharts production trend chart with dual axes for oil area and gas line plus a water/water-cut mode.
- Created a field-contribution donut chart with center total, field colors, well counts, water cut, and oil-share legend.
- Implemented a forecast projection chart merging actual monthly points with P50 forecast, P10–P90 band, and a base-date reference line.
- Built a downtime reason bar chart and daily downtime area chart with custom tooltips and reason color mapping.
- Added custom SVG sparklines for KPI cards to avoid full chart overhead for small trend indicators.
- Designed a dark operations theme using CSS variables, Inter and JetBrains Mono variable fonts, and an amber/teal/water-blue data palette.
- Implemented responsive breakpoints at 1380, 1180, 1024, 820, and 620 pixels for KPI, chart, table, sidebar, filter, and modal behavior.
- Added focus-visible rings, reduced-motion support, responsive table scrolling, accessible labels, and color-plus-text status badges.
- Built reusable KPI, panel, badge, pagination, skeleton, empty, error, confirm, and modal components for consistent UI composition.

## Validation, Reliability & Accessibility

- Enforced server-side validation for well identity, dates, numeric bounds, enums, and text lengths with matching client-side checks.
- Added conflict handling for duplicate API numbers and duplicate production dates.
- Used write transactions and read-only transactions to keep aggregate reads and multi-entity deletions consistent.
- Centralized API exceptions with structured logging and client-safe error messages.
- Added safe process ownership checks in `stop.sh` so only the Meridian jar or main class can be terminated.
- Implemented IPv4/IPv6 health probes, listener fallback, stale-PID cleanup, and graceful SIGTERM-to-SIGKILL shutdown.
- Added accessible dialog semantics, icon-button labels, live toast announcements, and `aria-pressed` segmented controls.

## Testing, Build & Delivery

- Wrote four JUnit 5/AssertJ tests covering exponential fit accuracy, hyperbolic b-factor fitting, minimum-history rejection, and economic-limit sensitivity.
- Wrote three MockMvc integration tests covering well creation/listing, field-level validation errors, metadata, and empty forecast lists.
- Configured Spring Boot's `spring-boot-webmvc-test` module for MockMvc under `@SpringBootTest`.
- Used isolated in-memory H2 and disabled seeding in integration tests.
- Added a `tsc --noEmit` gate to the production build so TypeScript errors fail `npm run build`.
- Configured Maven to copy `frontend/dist` into `target/classes/static` so the executable jar serves the SPA.
- Added a Maven `frontend` profile that runs `npm install` and `npm run build` through `exec-maven-plugin`.
- Built `run.sh` with toolchain checks, dependency sync, UI/jar builds, foreground/background modes, PID/log management, and health-gated startup.
- Built a standalone `stop.sh` with stale-PID recovery, IPv4/IPv6 listener fallback, ownership verification, timeout escalation, and idempotent behavior.

## Data Seeding & Operations

- Seeded a deterministic 18-well, four-field asset with 540 days of production, over 8,300 daily records, 100+ downtime events, and five forecasts using a fixed random seed.
- Modeled realistic decline, water-cut growth, GOR, seasonal variation, pressure, choke, well statuses, and active/resolved outages in seed generation.
- Added idempotent startup seeding controlled by `app.seed.enabled` that only runs on an empty database and persists to `data/meridian.mv.db`.
- Documented architecture, API surface, forecast methodology, IPv6 access, H2 console, commands, configuration, and test strategy in the README.
