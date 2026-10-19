# Epic: Databricks MDM Engine - Production Workflow & Hub Architecture

## Overview
This epic restructures the Databricks Master Data Management (MDM) Engine front-end to deliver a production-grade, frictionless workflow:
1. **Landing Page Refactor**: Remove all traces of "Dashboard" and transition to a minimal, elegant Multi-Workspace Connection Hub.
2. **In-Page MDM Table Registration**: Enable users to browse and register Databricks Unity Catalog tables directly inside the active MDM page.
3. **Dual Master Schema Definition**: Provide two structured pathways when establishing a master model:
   - Option A: Manual column-by-column schema definition.
   - Option B: Automated schema inference directly from a Databricks source table.
4. **Source Profiling & Canonical Mapping Flow**: Integrated in-page data analysis (profiling, sample records, null health) and intelligent schema mapping into golden records.

---

## Jira Stories & Execution Roadmap

| Issue Key | Story Title | Status | Assignee | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **[MDM-101](./MDM-101-landing-page-clean-minimal.md)** | Refactor Landing Page to Minimal Multi-Workspace Hub (Remove "Dashboard") | DONE | Antigravity AI | High |
| **[MDM-102](./MDM-102-in-page-mdm-table-registration.md)** | Embedded In-Page Databricks Table Registration in MDM Workspace | DONE | Antigravity AI | High |
| **[MDM-103](./MDM-103-dual-schema-definition-workflow.md)** | Dual Master Schema Definition (Custom Columns vs Databricks Inference) | DONE | Antigravity AI | High |
| **[MDM-104](./MDM-104-source-analysis-and-schema-mapping-flow.md)** | Unified Source Profiling, Canonical Schema Mapping & Golden Pipeline Flow | DONE | Antigravity AI | High |
| **[MDM-105](./MDM-105-mapping-verification-save-flow.md)** | Mapping Verification & Dedicated Save Mapping Flow | DONE | Antigravity AI | High |
| **[MDM-106](./MDM-106-live-databricks-table-analysis.md)** | Live Databricks Connected Tables Analysis in Step 3 | DONE | Antigravity AI | High |
| **[MDM-107](./MDM-107-golden-records-confidence-and-sources-fix.md)** | Golden Records Confidence Percentage & Contributing Source Name Display | DONE | Antigravity AI | High |
| **[MDM-108](./MDM-108-e2e-verification-and-regression-testing.md)** | End-to-End Flow Verification & Regression Testing | DONE | Antigravity AI | Medium |
| **[MDM-109](./MDM-109-sidebar-mdm-deduplication.md)** | Master Domain Sidebar Deduplication & State Sanitation | DONE | Antigravity AI | Medium |
| **[MDM-110](./MDM-110-swap-step1-and-step2-flow.md)** | Reorder MDM Onboarding Flow (Step 1: Source Ingestion, Step 2: Master Schema) | DONE | Antigravity AI | High |
| **[MDM-111](./MDM-111-intelligent-schema-suggestion-from-selected-tables.md)** | Step 2 Option 1: Automated Schema Suggestion from Selected Tables | DONE | Antigravity AI | High |
| **[MDM-112](./MDM-112-source-schema-adoption-with-edit-delete.md)** | Step 2 Option 2: Pick from Registered Sources with Edit & Delete | DONE | Antigravity AI | High |
| **[MDM-113](./MDM-113-step3-mapping-with-inline-column-management.md)** | Step 3: Schema Mapping, Live Analysis & Master Column Management | DONE | Antigravity AI | High |
| **[MDM-114](./MDM-114-streamline-step1-remove-redundant-table-list.md)** | Streamline Step 1: Remove Redundant Registered Source Tables Card | DONE | Antigravity AI | High |

---

## Core Acceptance Criteria
- [x] Zero references to the word "Dashboard" on the landing page or breadcrumbs.
- [x] Landing page cleanly presents workspace connection cards; clicking a card reveals its minimal overview.
- [x] When creating or opening an MDM, table registration occurs **inside** that MDM page without bouncing the user out.
- [x] User has two clear paths to create master structure: manual column entry or pick from Databricks table.
- [x] Source table profiling (column types, row counts, data inspection) and canonical mapping occur in a coherent, productionizable sequence.
