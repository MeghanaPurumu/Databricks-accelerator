# JIRA: MDM-101
## Title: Refactor Landing Page to Minimal Multi-Workspace Hub (Remove "Dashboard")

### Issue Type
Story / Improvement

### Priority
High

### Description
The current landing page displays "Established Connections & Dashboard" with heavy multi-tab dashboard analytics. The user requested:
1. Remove the word "Dashboard" entirely from the landing page.
2. The landing page should represent different workspace connections (Resource Groups / Databricks Workspaces).
3. Clicking on a workspace connection displays a minimal, focused overview of that connection (status, host, catalogs, schemas, health).
4. Keep the design minimal, production-grade, and sleek.

### Acceptance Criteria
- [ ] Header banner reads "Established Connections" or "Workspace Connections Hub" without any "Dashboard" phrasing.
- [ ] Display workspace cards (e.g. Primary Databricks Workspace, Analytics Lakehouse, Dev/Sandbox) with connection state badges.
- [ ] Clicking a workspace card selects it and reveals a clean, minimal Overview panel showing:
  - Connection Health & Protocol (Unity Catalog REST / SQL Warehouse)
  - Host URL & Auth PAT state
  - Discovered Catalogs & Schemas preview
  - Quick actions: Test Connection, Open Connection Page, or Explore MDMs.
- [ ] No cluttered graphs or redundant sub-tabs on this landing page.
