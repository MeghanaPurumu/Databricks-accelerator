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

audit_service = AuditService()

# ── Connection Mode Status Banner ─────────────────────────────────────────────
from utils.db import is_databricks, get_connection_status
conn = get_connection_status()
in_databricks = conn.get("connected", False)
current_identity = conn.get("current_identity") or "&lt;your-service-principal-or-email&gt;"

if audit_service.using_live_db:
    # State 1 ✅  Live Delta table is connected
    st.markdown(
        f"""
        <div style='display:flex; align-items:center; gap:10px; background:#F0FDF4;
                    border:1px solid #BBF7D0; border-radius:6px; padding:10px 16px; margin-bottom:16px;'>
            <span style='color:#0F9D58; font-size:18px;'>&#9679;</span>
            <div>
                <span style='font-size:12px; font-weight:600; color:#14532D;'>Live Delta Table Connected</span>
                <span style='font-size:11px; color:#166534; margin-left:8px;'>
                    Audit logs are persisted to
                    <code style='background:#DCFCE7; padding:1px 4px; border-radius:2px;'>{audit_service.table_name}</code>
                </span>
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )
elif in_databricks:
    # State 2 ⚠️  Databricks is reachable but the audit table could not be created
    import os as _os
    _catalog = _os.environ.get("DATABRICKS_CATALOG", "dev")
    _schema  = _os.environ.get("DATABRICKS_SCHEMA",  "brz")
    
    error_detail_html = ""
    if hasattr(audit_service, "bootstrap_error") and audit_service.bootstrap_error:
        error_detail_html = f"""
        <div style='margin-top: 10px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FCA5A5;
                    border-radius: 4px; font-family:"JetBrains Mono",monospace; font-size: 11px; color: #991B1B;'>
            <strong>Error details:</strong> {audit_service.bootstrap_error}
        </div>
        """
        
    st.markdown(
        f"""
        <div style='background:#FFFBEB; border:1px solid #FDE68A; border-radius:8px;
                    padding:14px 18px; margin-bottom:16px;'>
            <div style='display:flex; align-items:center; gap:8px; margin-bottom:6px;'>
                <span style='font-size:16px;'>&#9888;&#65039;</span>
                <span style='font-size:13px; font-weight:600; color:#78350F;'>
                    Audit Log is in Session-only Fallback Mode
                </span>
            </div>
            <p style='font-size:12px; color:#92400E; margin:0 0 10px;'>
                The table <code style='background:#FEF3C7; padding:1px 5px; border-radius:3px;'>{audit_service.table_name}</code>
                does not exist and could not be created automatically. This is usually a permissions issue.
                Ask your Databricks admin to run:
            </p>
            <div style='background:#FEF9C3; border:1px solid #FDE68A; border-radius:5px;
                        padding:8px 12px; font-family:"JetBrains Mono",monospace; font-size:12px; color:#713F12;'>
                GRANT CREATE TABLE ON SCHEMA {_catalog}.{_schema} TO `{current_identity}`;
            </div>
            {error_detail_html}
            <p style='font-size:11px; color:#A16207; margin:8px 0 0;'>
                Until resolved, audit logs are stored in memory for this session only and will not persist across restarts.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )
else:
    # State 3 🔵  Running locally / no Databricks connection — demo / offline mode
    st.markdown(
        """
        <div style='display:flex; align-items:flex-start; gap:10px; background:#EFF6FF;
                    border:1px solid #BFDBFE; border-radius:8px; padding:12px 16px; margin-bottom:16px;'>
            <span style='font-size:18px; margin-top:1px;'>&#128216;</span>
            <div>
                <span style='font-size:12px; font-weight:600; color:#1E3A5F;'>Demo / Offline Mode</span>
                <span style='font-size:11px; color:#1D4ED8; margin-left:6px;'>No Databricks connection detected</span>
                <p style='font-size:11px; color:#3B82F6; margin:4px 0 0;'>
                    Audit logs are loaded from in-memory seed data for demonstration purposes.
                    Connect a Databricks workspace to enable persistent, live audit trail storage.
                </p>
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

# ── Summary Metrics ────────────────────────────────────────────────────────────
m1, m2, m3, m4 = st.columns(4)
m1.metric("Total Records",  len(filtered_df))
m2.metric("Approvals",      len(filtered_df[filtered_df["Decision"] == "APPROVE"]))
m3.metric("Rejections",     len(filtered_df[filtered_df["Decision"] == "REJECT"]))
m4.metric("Modifications",  len(filtered_df[filtered_df["Decision"] == "MODIFY"]))

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

csv_data = filtered_df.to_csv(index=False).encode("utf-8")
st.download_button(
    label="Export Audit Logs (CSV)",
    data=csv_data,
    file_name="governance_audit_trail.csv",
    mime="text/csv"
)
