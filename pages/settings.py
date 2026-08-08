import streamlit as st
from utils.permissions import check_permission_page
from utils.helpers import render_top_header

check_permission_page("manage_settings")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;'>Settings</h2>"
    "<p style='font-size:13px;color:#6B7280;'>Configure governance thresholds, notification preferences, and default workspace scope.</p>",
    unsafe_allow_html=True
)

st.markdown("<div class='section-title'>Classification Thresholds</div>", unsafe_allow_html=True)

conf_threshold = st.slider(
    "Minimum Confidence Threshold",
    min_value=0.50, max_value=0.95,
    value=st.session_state.get("confidence_threshold", 0.70),
    step=0.05,
    help="Items below this confidence level will be flagged as high priority in the review queue."
)

auto_approval_threshold = st.slider(
    "Auto-Approval Threshold",
    min_value=0.80, max_value=1.00,
    value=st.session_state.get("auto_approval_threshold", 0.95),
    step=0.01,
    help="Items at or above this confidence level are automatically approved without steward review."
)

st.markdown("<div class='section-title'>Workspace Configuration</div>", unsafe_allow_html=True)

from utils.db import get_connection_status
status = get_connection_status()

if status["connected"]:
    st.success(f"Connected to Databricks Workspace: SQL Warehouse ID '{status['warehouse_id']}'")
else:
    st.error("Running in Mock Mode: No active Databricks Connection.")
    if status["error"]:
        st.warning(f"Last Connection Error: {status['error']}")

refresh_interval = st.number_input(
    "Queue Refresh Interval (seconds)",
    min_value=10, max_value=3600,
    value=st.session_state.get("refresh_interval", 30),
    step=10,
    help="How frequently the review queue polls for new items."
)

default_schema = st.text_input(
    "Default Schema Scope",
    value=st.session_state.get("default_schema", "clinical"),
    help="The default schema shown in search and classification views on load."
)

notifications_enabled = st.checkbox(
    "Enable In-App Alerts and Notifications",
    value=st.session_state.get("notifications_enabled", True)
)

st.markdown("<hr style='border:0;border-top:1px solid #E5E7EB;margin:16px 0;'>", unsafe_allow_html=True)

if st.button("Save Settings", type="primary"):
    st.session_state.confidence_threshold    = conf_threshold
    st.session_state.auto_approval_threshold = auto_approval_threshold
    st.session_state.refresh_interval        = refresh_interval
    st.session_state.default_schema          = default_schema
    st.session_state.notifications_enabled   = notifications_enabled
    st.success("Settings saved successfully.")
