# JIRA: MDM-104
## Title: Unified Source Data Profiling, Canonical Schema Mapping & Golden Pipeline Flow

### Issue Type
Story / Feature

### Priority
High

### Description
The user requested:
"And then schema mapping, analysing the source that is selected all these should happen in a proper flow. Make sure the changes that you make in UI are productionizable."

### Acceptance Criteria
- [ ] **Source Profiling & Analysis**:
  - Displays selected source table metadata: row count, column data types, sample records preview, null percentage, and data readiness score.
- [ ] **Interactive Schema Mapping**:
  - Visual side-by-side mapping between Source Columns and Master Canonical Golden Columns.
  - Auto-map button to match identical or similar column names.
  - Type-compatibility indicator and transformation rules (direct, trim, uppercase, hash).
- [ ] **Pipeline Execution / Golden Consolidation**:
  - Once mapping is confirmed, user can immediately trigger consolidation or view golden records without page jumps.
  - Sleek, production-grade UI with clear status indicators, error handling, and high-aesthetic styling.
