# Implementation Plan — GovernX Governance Steward Portal

## Project Overview

**GovernX** is an AI-assisted **Governance Steward Portal** built as a Databricks App (Streamlit). It is the application layer for a broader Databricks Governance Accelerator targeting healthcare and financial compliance teams.

The portal consumes outputs from Unity Catalog, Agentic Data Classification agents, Ontology Lookup, Similarity Search, and Supervisor Agents — **none of which are implemented here**. All external services are represented by stateful mock layers that can be swapped with real integrations at deployment time.

---

## Scope: Application Layer Only

| In Scope | Out of Scope |
|---|---|
| Streamlit multi-page app (all pages) | AI classification pipeline |
| Service integration wrappers | Unity Catalog infrastructure setup |
| Review queue, bulk actions, decision console | Ontology creation / management |
| Governance audit trail | Similarity search engine |
| Dashboard KPIs and analytics | ABAC policy enforcement engine |
| Role-based access control (RBAC) | Data pipelines / schema-watch agents |
| Databricks App deployment packaging | Supervisor agent logic |

---

## Architecture

```
GovernX/
├── app.py                         # Entry point — st.navigation, sidebar, role simulator
├── requirements.txt               # streamlit, pandas, plotly, pydantic
│
├── config/
│   └── settings.py                # Default thresholds, session_state initialization
│
├── models/
│   ├── classification.py          # ClassificationItem Pydantic model (AI fields, timelines)
│   └── audit.py                   # AuditEntry Pydantic model (GD IDs, duration, method)
│
├── services/
│   ├── governance_service.py      # Pending classifications: CRUD + mock data
│   ├── audit_service.py           # Audit log persistence + decision logger
│   ├── unity_catalog_service.py   # UC tag writes + catalog search
│   └── qa_service.py              # Governance Q&A agent wrapper
│
├── utils/
│   ├── auth.py                    # Databricks header extraction + session fallback
│   ├── permissions.py             # 4-role RBAC dictionary
│   └── helpers.py                 # CSS injection, header, status badges, format helpers
│
└── pages/
    ├── dashboard.py               # KPIs, Governance Insights, activity log
    ├── review_queue.py            # AI Workbench — three-panel console + bulk actions
    ├── classification_explorer.py # PII/PHI/Financial tag taxonomy browser
    ├── search.py                  # Unity Catalog asset search
    ├── governance_qa.py           # Copilot-style Q&A chat
    ├── audit.py                   # Immutable audit trail + CSV export
    ├── reports.py                 # Coverage analytics + governance trend charts
    └── settings.py                # Governance thresholds + notification config
```

---

## Data Models

### ClassificationItem (`models/classification.py`)

| Field | Type | Description |
|---|---|---|
| `id` | str | Unique item ID |
| `schema_name` | str | Source schema |
| `table_name` | str | Source table |
| `column_name` | str | Column flagged for review |
| `data_type` | str | SQL data type |
| `suggested_tag` | str | AI-recommended classification tag |
| `confidence_score` | float | AI confidence (0.0 – 1.0) |
| `priority` | str | Critical / High / Medium / Low |
| `category` | str | PII / PHI / Financial |
| `domain` | str | Business domain |
| `concept_match` | str | Ontology concept matched |
| `concept_confidence` | float | Ontology match score |
| `similar_columns_metrics` | list[dict] | [{name, similarity%}] |
| `governance_timeline` | list[dict] | [{stage, timestamp}] |
| `status` | str | PENDING / APPROVED / REJECTED / ESCALATED |
| `submitted_time` | datetime | When flagged by classification agent |

### AuditEntry (`models/audit.py`)

| Field | Type | Description |
|---|---|---|
| `governance_decision_id` | str | Unique GD-XXXXX identifier |
| `timestamp` | datetime | Decision timestamp |
| `user_email` | str | Steward who acted |
| `schema_name` | str | Asset schema |
| `table_name` | str | Asset table |
| `column_name` | str | Asset column |
| `previous_tag` | str | Tag before decision |
| `new_tag` | str | Tag after decision |
| `decision` | str | APPROVE / REJECT / MODIFY / ESCALATE |
| `ai_recommendation` | str | What AI suggested |
| `confidence_score` | float | AI confidence at review time |
| `approval_duration` | str | e.g. "42s" |
| `approval_method` | str | Manual Review / Bulk Approval |
| `comments` | str | Steward notes |

---

## Pages and Features

### Dashboard (`pages/dashboard.py`)
- **Governance Insights Row**: Avg Review Time, AI Accuracy %, Override Rate, Highest Risk Schema
- **KPI Cards**: Schemas, Classified Columns (with auto-approved count), Pending Reviews, PII/PHI counts
- **Charts**: Status donut, Pending by Schema bar, Confidence histogram, Top tags horizontal bar
- **Recent Activity Log**: Last 5 decisions with GD IDs, reviewer, asset path, duration
- All column access uses `model_dump()` snake_case keys

### Review Queue / AI Workbench (`pages/review_queue.py`)
- **Advanced Filter Bar**: Schema, Business Domain, Sensitivity, Status, Priority, Min Confidence Slider, Column Search, Reviewer
- **Queue List**: Checkbox-per-row, Asset Path, Classification Suggestion, Priority with color coding, Confidence Score, Open Console button
- **Bulk Actions**: Bulk Approve and Bulk Reject buttons activate only when rows are selected
- **Three-Panel Investigation Console** (opens when "Open Console" clicked):
  - **Left Panel**: Asset details table, Masked sample values, Policies applied on approval
  - **Center Panel / AI Reasoning tab**: Tag + confidence header, Ontology match, Clickable similar columns (navigate to that item's console), AI Decision Flow timeline (5 sequential steps)
  - **Center Panel / Governance Timeline tab**: Vertical stage tracker for each lifecycle stage
  - **Right Panel**: Decision action selector (Approve / Reject / Modify / Merge / Escalate / Request Info / Draft), Classification tag input, Steward notes, Confirmation checkbox, Submit Decision button, 6-step animated approval workflow progress bar

### Classification Explorer (`pages/classification_explorer.py`)
- Tag category cards: PII, PHI, Financial/Other — each with count and tag list
- Full tagged column table below

### Governance Search (`pages/search.py`)
- Free-text search against Unity Catalog metadata
- Results table with Schema, Table, Column, Tag, Masking Policy, ABAC Policy, Reviewer, Status

### Governance Q&A (`pages/governance_qa.py`)
- Suggested question chips for common governance queries
- `st.chat_message` conversation interface
- Delegates to `QAService.ask()` which calls the Governance Q&A Agent REST endpoint

### Audit Logs (`pages/audit.py`)
- Full-featured filter panel: Reviewer, Decision, Schema, Approval Method, Keyword Search
- Summary metrics row: Total, Approvals, Rejections, Modifications
- Full audit table including GD IDs, AI Confidence, Duration, Method
- CSV export download button

### Reports (`pages/reports.py`)
- Coverage %, AI Accuracy %, Override Rate, Pending Queue size
- Sensitive data distribution bar chart (PII / PHI / Other)
- Governance activity trend line over time
- CSV export for classification summary

### Settings (`pages/settings.py`)
- Confidence Threshold slider
- Auto-Approval Threshold slider
- Queue Refresh Interval
- Default Schema Scope
- In-App Alerts toggle

---

## Access Control (RBAC)

| Permission | Governance Steward | Compliance Officer | Data Engineer | Read-only Analyst |
|---|:---:|:---:|:---:|:---:|
| View Dashboard | Yes | Yes | Yes | Yes |
| View Review Queue | Yes | Yes | Yes | Yes |
| Approve / Reject | Yes | Yes | No | No |
| View Audit | Yes | Yes | Yes | No |
| View Q&A | Yes | Yes | Yes | Yes |
| Manage Settings | Yes | No | No | No |

---

## Service Integration Points (Production Swap)

| Mock Service | Production Replacement |
|---|---|
| `governance_service.py` | `spark.read.table("pending_classifications")` |
| `audit_service.py` | `spark.sql("INSERT INTO governance_audit ...")` |
| `unity_catalog_service.py` | Databricks SDK `client.catalog.alter_column_tag()` or `ALTER TABLE ... SET TAGS` |
| `qa_service.py` | HTTP POST to Governance Q&A Agent REST endpoint |

---

## UI Design System

- **Font**: Inter (Google Fonts), 300–700 weight range
- **Background**: `#F7F8FC` (off-white)
- **Cards**: `#FFFFFF` with `1px solid #E5E7EB` border, `8px` radius
- **Primary Blue**: `#1D4ED8`
- **Success Green**: `#059669`
- **Warning Amber**: `#D97706`
- **Error Red**: `#DC2626`
- **Body Text**: `#111827`
- **Secondary Text**: `#6B7280`
- **Section Titles**: 11px uppercase, 0.06em letter-spacing, `#6B7280`
- **No emojis or decorative symbols** anywhere in the UI

---

## Deployment (Databricks App)

1. Upload `GovernX/` folder to Databricks Workspace
2. Navigate to **Compute > Apps > Create App**
3. Set **Source**: Workspace path to `GovernX/`
4. Set **Entrypoint**: `app.py`
5. Optionally add `app.yaml`:
   ```yaml
   name: "governx-steward-portal"
   entrypoint: "streamlit run app.py"
   ```
6. Grant **Can Use** to governance stewards and compliance officers
7. `utils/auth.py` auto-extracts the Databricks user from the `X-User-Email` header

---

## Implementation Status

| Component | Status |
|---|---|
| `app.py` — Navigation + sidebar | Done |
| `models/classification.py` | Done |
| `models/audit.py` | Done |
| `services/governance_service.py` | Done |
| `services/audit_service.py` | Done |
| `services/unity_catalog_service.py` | Done |
| `services/qa_service.py` | Done |
| `utils/auth.py` | Done |
| `utils/permissions.py` | Done |
| `utils/helpers.py` | Done |
| `pages/dashboard.py` | Done |
| `pages/review_queue.py` | Done |
| `pages/classification_explorer.py` | Done |
| `pages/search.py` | Done |
| `pages/governance_qa.py` | Done |
| `pages/audit.py` | Done |
| `pages/reports.py` | Done |
| `pages/settings.py` | Done |
| Bug fixes (unsafe_html, KeyError) | Done |
| Professional UI (no emojis, Inter font) | Done |
