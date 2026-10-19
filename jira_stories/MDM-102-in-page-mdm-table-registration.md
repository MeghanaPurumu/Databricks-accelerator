# JIRA: MDM-102
## Title: Embedded In-Page Databricks Table Registration in MDM Workspace

### Issue Type
Story / Feature

### Priority
High

### Description
Currently, when a user creates or clicks an MDM, they are either navigated to a Golden Records page where table registration is missing, or they have to go out of the page back to the Master Data Hub to find the registration section.
The user requirement states:
"Once the user creates new MDM and clicks on that MDM, inside that MDM page itself they should be able to register the tables from Databricks, currently the user has to go out of the page, fix that flow."

### Acceptance Criteria
- [ ] Inside the MDM page (`/master-data/:mdmId/golden-records` or dedicated MDM detail view), include a dedicated **"Data Sources & Registration"** tab or section.
- [ ] Users can browse Databricks Catalogs, Schemas, and Tables directly inside the MDM page.
- [ ] Users can multi-select or single-select tables and click "Register to this MDM" without navigating away.
- [ ] Registered tables are immediately attached to this MDM and listed in the source inventory table with row counts and status.
