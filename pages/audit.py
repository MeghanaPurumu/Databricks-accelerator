import os
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

# ── Connection Mode Status Banner ─────────────────────────────────────────────
from utils.db import is_databricks, get_connection_status, get_spark
conn = get_connection_status()

if audit_service.using_live_db:
    # Live Delta table connected
    st.markdown(
        f"""
        <div style='display:flex; align-items:center; gap:10px; background:#F0FDF4;
                    border:1px solid #BBF7D0; border-radius:6px; padding:10px 16px; margin-bottom:16px;'>
            <span style='color:#0F9D58; font-size:12px;'>&#9679;</span>
            <div>
                <span style='font-size:12px; font-weight:600; color:#14532D;'>Live Delta Table Connected</span>
                <span style='font-size:11px; color:#166534; margin-left:8px;'>
                    Reading from <code style='background:#DCFCE7; padding:1px 4px; border-radius:2px;'>{audit_service.table_name}</code>
                </span>
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )
elif conn.get("has_client") and conn.get("warehouse_id"):
    # Connected to Databricks with a warehouse but table missing or no CREATE privileges
    st.markdown(
        f"""
        <div style='background:#FFFBEB; border:1px solid #FDE68A; border-radius:6px; padding:12px 16px; margin-bottom:16px;'>
            <div style='display:flex; align-items:center; gap:8px; margin-bottom:6px;'>
                <span style='color:#F59E0B; font-size:12px;'>&#9679;</span>
                <span style='font-size:12px; font-weight:600; color:#92400E;'>Session Fallback Mode — Audit Log Not Persisted</span>
            </div>
            <div style='font-size:12px; color:#78350F;'>
                The table <code style='background:#FEF3C7; padding:1px 4px; border-radius:2px;'>{audit_service.table_name}</code>
                does not exist or the app lacks <strong>CREATE TABLE</strong> privileges on
                <code style='background:#FEF3C7; padding:1px 4px; border-radius:2px;'>{os.environ.get('DATABRICKS_CATALOG', 'dev')}.{os.environ.get('DATABRICKS_SCHEMA', 'brz')}</code>.
                Audit records are stored in session memory only and will be lost on restart.
            </div>
            <div style='font-size:11px; color:#78350F; margin-top:8px; background:#FEF3C7; padding:6px 10px; border-radius:4px; font-family:monospace;'>
                GRANT CREATE TABLE ON SCHEMA {os.environ.get('DATABRICKS_CATALOG', 'dev')}.{os.environ.get('DATABRICKS_SCHEMA', 'brz')} TO `your-email@company.com`;
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )
else:
    # Offline / local mode — no live Databricks connection available
    st.markdown(
        """
        <div style='display:flex; align-items:center; gap:10px; background:var(--surface-sunken);
                    border:1px solid var(--border); border-radius:6px; padding:10px 16px; margin-bottom:16px;'>
            <span style='color:#6B7280; font-size:12px;'>&#9679;</span>
            <div style='font-size:12px; color:var(--ink-muted);'>
                <strong>Offline Mode</strong> — Showing session-state audit logs. Connect to Databricks to persist decisions.
            </div>
        </div>
        """,
        unsafe_allow_html=True
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
