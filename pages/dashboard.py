import streamlit as st
import pandas as pd
import plotly.express as px
from services.governance_service import GovernanceService
from services.audit_service import AuditService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header, render_confidence_ring, get_category_color

check_permission_page("view_dashboard")
render_top_header()

gov_service   = GovernanceService()
audit_service = AuditService()

all_items  = gov_service.get_pending_classifications()
audit_logs = audit_service.get_audit_history()

df_items = pd.DataFrame([item.model_dump() for item in all_items])
df_audit = pd.DataFrame([log.model_dump()  for log  in audit_logs])

# ── Aggregations ──────────────────────────────────────────────────────────────
total_schemas   = 3
total_tables    = 12
total_columns   = 150

pending_count   = int((df_items["status"] == "PENDING").sum())
approved_count  = int((df_items["status"] == "APPROVED").sum()) + int((df_audit["decision"] == "APPROVE").sum())
rejected_count  = int((df_items["status"] == "REJECTED").sum()) + int((df_audit["decision"] == "REJECT").sum())
auto_classified = int((df_items["confidence_score"] >= st.session_state.get("auto_approval_threshold", 0.95)).sum())
classified_cols = int((df_items["status"] == "APPROVED").sum()) + 20
pii_count       = int(df_items["suggested_tag"].str.contains("pii", case=False).sum())
phi_count       = int(df_items["suggested_tag"].str.contains("phi", case=False).sum())

total_decisions = len(df_audit)
ai_accuracy     = (int((df_audit["decision"] == "APPROVE").sum()) / total_decisions) if total_decisions else 0.0
override_pct    = (int((df_audit["decision"] == "MODIFY").sum())  / total_decisions * 100) if total_decisions else 0.0

st.markdown(
    "<h1 style='font-size:24px; font-weight:600; color:#111827; margin-bottom:20px;'>Welcome to Governance</h1>",
    unsafe_allow_html=True
)

# ── Databricks Style Metric Cards Row ──────────────────────────────────────────
kpi_cols = st.columns(5)

kpis = [
    ("Pending triage", f"{pending_count}", "Require action", "var(--warning)"),
    ("Classified columns", f"{classified_cols}", f"{auto_classified} auto-approved", "var(--success)"),
    ("Sensitive PII", f"{pii_count}", "Requires masking", "var(--pii)"),
    ("Sensitive PHI", f"{phi_count}", "Requires ABAC", "var(--phi)"),
    ("Override rate", f"{override_pct:.1f}%", "Manual corrections", "var(--danger)")
]

for col, (label, value, sub, color) in zip(kpi_cols, kpis):
    with col:
        st.markdown(
            f"""
            <div class="db-metric-card">
                <div>
                    <div class="db-metric-label">{label}</div>
                    <div class="db-metric-value">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: {color}; display: inline-block;"></span>
                        {value}
                    </div>
                    <div class="db-metric-sub">{sub}</div>
                </div>
                <div style="color: var(--ink-muted); font-size: 14px; font-weight: 500;">&gt;</div>
            </div>
            """,
            unsafe_allow_html=True
        )

st.markdown("<div style='margin-top:24px;'></div>", unsafe_allow_html=True)

# ── Databricks Style "Courses" & "Demos" Two-Column Layout ────────────────────
st.markdown(
    "<div style='font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; display: flex; align-items: center; gap: 6px;'>"
    "Triage workbench &amp; diagnostics &gt;"
    "</div>",
    unsafe_allow_html=True
)

col_left, col_right = st.columns(2)

with col_left:
    st.markdown(
        "<div style='font-size:13px; font-weight:600; color:#374151; margin-bottom:10px;'>Pending Sensitivity Queue</div>",
        unsafe_allow_html=True
    )
    st.markdown("<div style='background:#FFFFFF; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04); overflow:hidden;'>", unsafe_allow_html=True)
    
    pending_df = df_items[df_items["status"] == "PENDING"].head(3)
    
    if not pending_df.empty:
        for i, (_, row) in enumerate(pending_df.iterrows()):
            cat = row["category"] or "PII"
            color = get_category_color(cat)
            initial = cat[0].upper()
            border_top = "border-top:1px solid #F3F4F6;" if i > 0 else ""
            st.markdown(
                f"""
                <div style="background: #FFFFFF; {border_top} padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; background: {color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 13px; flex-shrink:0;">
                        {initial}
                    </div>
                    <div style="flex: 1; min-width:0;">
                        <div style="font-size: 13px; font-weight: 600; color: #111827;">{row['schema_name']}.{row['table_name']}.{row['column_name']}</div>
                        <div style="font-size: 11px; color: #64748B;">Suggested: {row['suggested_tag']} &middot; Confidence: {row['confidence_score']*100:.1f}% &middot; Priority: {row['priority']}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.markdown("</div>", unsafe_allow_html=True)
        st.info("No pending classifications to triage.")

with col_right:
    st.markdown(
        "<div style='font-size:13px; font-weight:600; color:#374151; margin-bottom:10px;'>Recent Audited Operations</div>",
        unsafe_allow_html=True
    )
    st.markdown("<div style='background:#FFFFFF; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04); overflow:hidden;'>", unsafe_allow_html=True)
    
    recent_audits = df_audit.head(3)
    
    if not recent_audits.empty:
        for i, (_, row) in enumerate(recent_audits.iterrows()):
            decision = row["decision"]
            color = "var(--success)" if decision == "APPROVE" else "var(--warning)" if decision == "MODIFY" else "var(--danger)"
            initial = decision[0].upper()
            border_top = "border-top:1px solid #F3F4F6;" if i > 0 else ""
            st.markdown(
                f"""
                <div style="background: #FFFFFF; {border_top} padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; background: {color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 13px; flex-shrink:0;">
                        {initial}
                    </div>
                    <div style="flex: 1; min-width:0;">
                        <div style="font-size: 13px; font-weight: 600; color: #111827;">{row['schema_name']}.{row['table_name']}.{row['column_name']}</div>
                        <div style="font-size: 11px; color: #64748B;">Action: {row['decision']} &middot; Decision ID: {row['governance_decision_id']} &middot; Duration: {row['approval_duration']}</div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        st.markdown("</div>", unsafe_allow_html=True)
        st.info("No audited logs recorded.")

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:24px 0 20px;'>", unsafe_allow_html=True)

# ── Charts ────────────────────────────────────────────────────────────────────
st.markdown("<div class='section-title'>Classification Analytics</div>", unsafe_allow_html=True)

c1, c2 = st.columns(2)

with c1:
    st.markdown("**Status Distribution**")
    status_df = pd.DataFrame({
        "Status": ["Pending", "Approved", "Rejected"],
        "Count":  [pending_count, approved_count, rejected_count]
    })
    fig = px.pie(
        status_df, names="Status", values="Count", hole=0.45,
        color="Status",
        color_discrete_map={"Pending": "#F4B400", "Approved": "#0F9D58", "Rejected": "#DB4437"}
    )
    fig.update_layout(
        margin=dict(t=10, b=10, l=10, r=10),
        showlegend=True,
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=11, color='#64748B')
    )
    st.plotly_chart(fig, use_container_width=True)

with c2:
    st.markdown("**Pending Reviews by Schema**")
    if not df_items.empty and pending_count > 0:
        schema_df = (df_items[df_items["status"] == "PENDING"]
                     .groupby("schema_name").size()
                     .reset_index(name="Count"))
        fig2 = px.bar(
            schema_df, x="schema_name", y="Count",
            labels={"schema_name": "Schema"},
            color_discrete_sequence=["#1A73E8"]
        )
        fig2.update_layout(
            margin=dict(t=10, b=10, l=10, r=10),
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(family='Inter', size=11, color='#64748B')
        )
        st.plotly_chart(fig2, use_container_width=True)
    else:
        st.info("No pending items to display.")
