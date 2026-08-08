import streamlit as st
import pandas as pd
import plotly.express as px
from services.governance_service import GovernanceService
from services.audit_service import AuditService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header

check_permission_page("view_dashboard")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Governance Reports</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Compliance metrics, coverage analytics, and governance activity trends.</p>",
    unsafe_allow_html=True
)

gov_service   = GovernanceService()
audit_service = AuditService()

all_items  = gov_service.get_pending_classifications()
audit_logs = audit_service.get_audit_history()

df_items = pd.DataFrame([item.model_dump() for item in all_items])
df_audit = pd.DataFrame([log.model_dump()  for log  in audit_logs])

total_columns     = 150
classified_cols   = len(df_items[df_items["status"] == "APPROVED"]) + 20
coverage_rate     = (classified_cols / total_columns) * 100
pending_reviews   = len(df_items[df_items["status"] == "PENDING"])
total_decisions   = len(df_audit)
approved_count    = len(df_audit[df_audit["decision"] == "APPROVE"]) if not df_audit.empty else 0
approval_rate     = (approved_count / total_decisions * 100) if total_decisions > 0 else 0.0
override_rate     = 100 - approval_rate if total_decisions > 0 else 0.0

# ── Summary KPIs ──────────────────────────────────────────────────────────────
st.markdown("<div class='section-title'>Report Summary</div>", unsafe_allow_html=True)
c1, c2, c3, c4 = st.columns(4)
c1.metric("Classification Coverage",    f"{coverage_rate:.1f}%")
c2.metric("AI Recommendation Accuracy", f"{approval_rate:.1f}%")
c3.metric("Manual Override Rate",       f"{override_rate:.1f}%")
c4.metric("Pending Queue",              pending_reviews)

# ── Charts ────────────────────────────────────────────────────────────────────
st.markdown("<div style='margin-top:20px;'></div>", unsafe_allow_html=True)
st.markdown("<div class='section-title'>Sensitive Data Distribution</div>", unsafe_allow_html=True)
pii_count = len(df_items[df_items["suggested_tag"].str.contains("pii", case=False)])
phi_count = len(df_items[df_items["suggested_tag"].str.contains("phi", case=False)])

dist_df = pd.DataFrame({
    "Sensitivity Type": ["PII", "PHI", "Other"],
    "Count":            [pii_count, phi_count, total_columns - pii_count - phi_count]
})
fig_dist = px.bar(
    dist_df, x="Sensitivity Type", y="Count",
    color="Sensitivity Type",
    color_discrete_map={"PII": "#7C3AED", "PHI": "#DB2777", "Other": "#E2E5ED"}
)
fig_dist.update_layout(
    showlegend=False,
    margin=dict(t=10, b=10, l=10, r=10),
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    font=dict(family='Inter', size=11, color='#64748B')
)
st.plotly_chart(fig_dist, use_container_width=True)

st.markdown("<div class='section-title'>Governance Activity Over Time</div>", unsafe_allow_html=True)
if not df_audit.empty:
    df_audit["day"] = pd.to_datetime(df_audit["timestamp"]).dt.date
    trend_df = df_audit.groupby("day").size().reset_index(name="Decisions")
    fig_line = px.line(
        trend_df, x="day", y="Decisions", markers=True,
        color_discrete_sequence=["#1D4ED8"]
    )
    fig_line.update_layout(
        margin=dict(t=10, b=10, l=10, r=10),
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        font=dict(family='Inter', size=11, color='#64748B')
    )
    st.plotly_chart(fig_line, use_container_width=True)
else:
    st.info("No governance decisions recorded yet.")

st.markdown("<div class='section-title'>Export Report Data</div>", unsafe_allow_html=True)
csv_data = df_items.to_csv(index=False).encode("utf-8")
st.download_button(
    label="Export Classification Summary (CSV)",
    data=csv_data,
    file_name="governance_classification_summary.csv",
    mime="text/csv"
)
