import streamlit as st
import pandas as pd
from services.audit_service import AuditService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header

check_permission_page("view_audit")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Governance Audit Trail</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Immutable record of all steward tagging decisions, modifications, and escalations.</p>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 20px;'>", unsafe_allow_html=True)

audit_service = AuditService()

# Show warning if running inside Databricks but Audit table connection is mock
from utils.db import is_databricks, get_connection_status
if is_databricks() and not audit_service.using_live_db:
    conn_status = get_connection_status()
    st.warning(
        "⚠️ **Running in Databricks but Audit Log is in Session-only Fallback Mode.**\n\n"
        f"This occurs because the table `{audit_service.table_name}` does not exist and the app could not create it. "
        "Please ensure your user/service identity has **`CREATE TABLE`** privileges on the schema `dev.brz` in Unity Catalog. "
        "Ask your administrator to run the following statement:\n"
        "```sql\n"
        f"GRANT CREATE TABLE ON SCHEMA {os.environ.get('DATABRICKS_CATALOG', 'dev')}.{os.environ.get('DATABRICKS_SCHEMA', 'brz')} TO `your-databricks-email@company.com`;\n"
        "```"
    )
logs = audit_service.get_audit_history()

if not logs:
    st.info("No audit logs found.")
    st.stop()

data = []
for entry in logs:
    data.append({
        "Decision ID":       entry.governance_decision_id,
        "Timestamp":         str(entry.timestamp)[:19],
        "Reviewer":          entry.user_email,
        "Schema":            entry.schema_name,
        "Table":             entry.table_name,
        "Column":            entry.column_name,
        "Previous Tag":      entry.previous_tag or "—",
        "New Tag":           entry.new_tag or "—",
        "AI Suggestion":     entry.ai_recommendation,
        "AI Confidence":     f"{entry.confidence_score * 100:.0f}%",
        "Decision":          entry.decision,
        "Duration":          entry.approval_duration,
        "Method":            entry.approval_method,
        "Comments":          entry.comments or "—"
    })
df = pd.DataFrame(data)

# ── Filters ───────────────────────────────────────────────────────────────────
st.markdown("<div class='section-title'>Filter Audit Records</div>", unsafe_allow_html=True)
c1, c2, c3, c4 = st.columns(4)

with c1:
    user_filter     = st.multiselect("Reviewer",         options=sorted(df["Reviewer"].unique()))
with c2:
    decision_filter = st.multiselect("Decision Action",  options=sorted(df["Decision"].unique()))
with c3:
    schema_filter   = st.multiselect("Schema",           options=sorted(df["Schema"].unique()))
with c4:
    method_filter   = st.multiselect("Approval Method",  options=sorted(df["Method"].unique()))

keyword = st.text_input("Keyword Search", placeholder="Search by column name, table, or comments...")

filtered_df = df.copy()
if user_filter:     filtered_df = filtered_df[filtered_df["Reviewer"].isin(user_filter)]
if decision_filter: filtered_df = filtered_df[filtered_df["Decision"].isin(decision_filter)]
if schema_filter:   filtered_df = filtered_df[filtered_df["Schema"].isin(schema_filter)]
if method_filter:   filtered_df = filtered_df[filtered_df["Method"].isin(method_filter)]
if keyword:
    kw = keyword.lower()
    filtered_df = filtered_df[
        filtered_df["Column"].str.lower().str.contains(kw) |
        filtered_df["Table"].str.lower().str.contains(kw)  |
        filtered_df["Comments"].str.lower().str.contains(kw)
    ]

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 16px;'>", unsafe_allow_html=True)

# ── Summary Metrics ────────────────────────────────────────────────────────────
m1, m2, m3, m4 = st.columns(4)
m1.metric("Total Records",  len(filtered_df))
m2.metric("Approvals",      len(filtered_df[filtered_df["Decision"] == "APPROVE"]))
m3.metric("Rejections",     len(filtered_df[filtered_df["Decision"] == "REJECT"]))
m4.metric("Modifications",  len(filtered_df[filtered_df["Decision"] == "MODIFY"]))

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 16px;'>", unsafe_allow_html=True)

st.markdown(f"<div style='font-size:13px;color:var(--ink-muted);margin-bottom:8px;'>Showing {len(filtered_df)} governance events</div>", unsafe_allow_html=True)

st.dataframe(
    filtered_df,
    column_config={
        "Decision ID":   st.column_config.TextColumn("Decision ID",    width="medium"),
        "Timestamp":     st.column_config.TextColumn("Timestamp",      width="medium"),
        "Reviewer":      st.column_config.TextColumn("Reviewer"),
        "Schema":        st.column_config.TextColumn("Schema"),
        "Table":         st.column_config.TextColumn("Table"),
        "Column":        st.column_config.TextColumn("Column"),
        "Previous Tag":  st.column_config.TextColumn("Previous Tag"),
        "New Tag":       st.column_config.TextColumn("New Tag"),
        "AI Suggestion": st.column_config.TextColumn("AI Suggested"),
        "AI Confidence": st.column_config.TextColumn("Confidence"),
        "Decision":      st.column_config.TextColumn("Decision"),
        "Duration":      st.column_config.TextColumn("Review Duration"),
        "Method":        st.column_config.TextColumn("Approval Method"),
        "Comments":      st.column_config.TextColumn("Comments",       width="large")
    },
    hide_index=True,
    use_container_width=True
)

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:16px 0;'>", unsafe_allow_html=True)
csv_data = filtered_df.to_csv(index=False).encode("utf-8")
st.download_button(
    label="Export Audit Logs (CSV)",
    data=csv_data,
    file_name="governance_audit_trail.csv",
    mime="text/csv"
)
