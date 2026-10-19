# JIRA: MDM-103
## Title: Dual Master Schema Definition (Custom Columns vs Databricks Source Inference)

### Issue Type
Story / Feature

### Priority
High

### Description
When creating or configuring an MDM structure, the user requested two clear, self-contained options:
"Also once after creating mdm, user should have two options: either to create the structure of the master by giving their column name, or to pick from sources from Databricks. Once after clicking any of this, user should proceed inside that page itself without losing any flow."

### Acceptance Criteria
- [ ] After an MDM is created, or when entering the Schema Definition step, provide two choice cards:
  - **Option 1: Define Custom Master Columns**: User adds custom canonical column names, data types (string, integer, double, date, boolean), primary key flag, and description.
  - **Option 2: Infer from Databricks Source Table**: User selects a discovered Databricks table; system reads its schema and populates the master canonical columns automatically.
- [ ] User proceeds to the next phase (schema verification / mapping) seamlessly without leaving the page.
- [ ] Changes persist to the MDM definition in `localStorage` and trigger global events for synchronization.
