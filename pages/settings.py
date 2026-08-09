import os
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

# ── Classification Thresholds ─────────────────────────────────────────────────
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

# ── Workspace Configuration ───────────────────────────────────────────────────
st.markdown("<div class='section-title'>Workspace Configuration</div>", unsafe_allow_html=True)

refresh_interval = st.number_input(
    "Queue Refresh Interval (seconds)",
    min_value=10, max_value=3600,
    value=st.session_state.get("refresh_interval", 30),
    step=10,
    help="How frequently the review queue polls for new items."
)

default_schema = st.text_input(
    "Default Schema Scope",
    value=st.session_state.get("default_schema", "brz"),
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

# ── Databricks Diagnostics Panel ──────────────────────────────────────────────
st.markdown("<div class='section-title'>Databricks Connection Diagnostics</div>", unsafe_allow_html=True)

from utils.db import get_connection_status, get_spark

status = get_connection_status()

_catalog = os.environ.get("DATABRICKS_CATALOG", "(not set)")
_schema  = os.environ.get("DATABRICKS_SCHEMA",  "(not set)")
_wh_env  = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")

def _diag_row(label: str, ok: bool, detail: str = ""):
    """Render a single diagnostic row with a colored status pill."""
    pill_color = "#0F9D58" if ok else "#DB4437"
    pill_label = "OK" if ok else "FAILED"
    detail_html = f"<span style='font-size:11px;color:#6B7280;margin-left:8px;'>{detail}</span>" if detail else ""
    st.markdown(
        f"<div style='display:flex;align-items:center;justify-content:space-between;"
        f"padding:7px 12px;background:var(--surface-sunken,#F9FAFB);"
        f"border-radius:5px;margin-bottom:4px;'>"
        f"<span style='font-size:13px;color:#374151;font-weight:500;'>{label}</span>"
        f"<span style='display:flex;align-items:center;gap:6px;'>"
        f"{detail_html}"
        f"<span style='background:{pill_color}18;color:{pill_color};font-size:10px;"
        f"font-weight:700;padding:2px 9px;border-radius:10px;letter-spacing:0.04em;'>"
        f"{pill_label}</span>"
        f"</span></div>",
        unsafe_allow_html=True
    )

def _diag_info(label: str, value: str):
    """Render a simple key/value info row."""
    st.markdown(
        f"<div style='display:flex;align-items:center;justify-content:space-between;"
        f"padding:5px 12px;'>"
        f"<span style='font-size:12px;color:#6B7280;'>{label}</span>"
        f"<span class='mono-text' style='font-size:12px;color:#111827;font-weight:500;'>{value}</span>"
        f"</div>",
        unsafe_allow_html=True
    )

st.markdown("<div class='panel-box'>", unsafe_allow_html=True)

# ── Section 1: Authentication & SDK ───────────────────────────────────────────
st.markdown(
    "<div style='font-size:11px;font-weight:600;color:#6B7280;letter-spacing:0.06em;"
    "text-transform:uppercase;margin-bottom:8px;'>Authentication & SDK</div>",
    unsafe_allow_html=True
)

_sdk_ok = status.get("has_client", False)
_sdk_detail = f"Identity: {status['current_identity']}" if status.get("current_identity") else ""
_diag_row("Databricks WorkspaceClient", _sdk_ok, _sdk_detail)

# ── Section 2: SQL Warehouse ───────────────────────────────────────────────────
st.markdown(
    "<div style='font-size:11px;font-weight:600;color:#6B7280;letter-spacing:0.06em;"
    "text-transform:uppercase;margin:12px 0 8px;'>SQL Warehouse</div>",
    unsafe_allow_html=True
)

_wh_configured = status.get("warehouse_configured", False)
# Mask all but last 6 chars of the warehouse ID for display (no full ID exposed)
_wh_display = ("..." + _wh_env[-6:]) if len(_wh_env) > 6 else ("MISSING" if not _wh_env else _wh_env)
_wh_detail  = f"ID ending: {_wh_display}" if _wh_configured else "Not bound via app.yaml"
_diag_row("DATABRICKS_WAREHOUSE_ID bound", _wh_configured, _wh_detail)

# Live query test: SELECT 1 via Statement Execution API
_sql_ok   = False
_sql_note = "Not attempted (warehouse not configured)"
if _wh_configured:
    try:
        spark = get_spark()
        if spark:
            spark.sql("SELECT 1")
            _sql_ok   = True
            _sql_note = "SELECT 1 executed successfully"
        else:
            _sql_note = "SQL Wrapper unavailable (check SDK auth)"
    except Exception as _e:
        _sql_note = f"Query failed: {str(_e)[:80]}"

_diag_row("SQL Warehouse reachable (SELECT 1)", _sql_ok, _sql_note)

# ── Section 3: Unity Catalog ───────────────────────────────────────────────────
st.markdown(
    "<div style='font-size:11px;font-weight:600;color:#6B7280;letter-spacing:0.06em;"
    "text-transform:uppercase;margin:12px 0 8px;'>Unity Catalog</div>",
    unsafe_allow_html=True
)

_diag_info("Catalog", _catalog)
_diag_info("Schema",  _schema)

# Check classification_results table
_cr_ok   = False
_cr_note = "Not attempted (warehouse not configured)"
if _sql_ok:
    try:
        spark = get_spark()
        spark.sql(f"SELECT COUNT(*) FROM {_catalog}.{_schema}.classification_results")
        _cr_ok   = True
        _cr_note = f"{_catalog}.{_schema}.classification_results"
    except Exception as _e:
        _cr_note = f"Error: {str(_e)[:80]}"

_diag_row("classification_results accessible", _cr_ok, _cr_note)

# Check governance_audit table
_ga_ok   = False
_ga_note = "Not attempted (warehouse not configured)"
if _sql_ok:
    try:
        spark = get_spark()
        spark.sql(f"SELECT COUNT(*) FROM {_catalog}.{_schema}.governance_audit")
        _ga_ok   = True
        _ga_note = f"{_catalog}.{_schema}.governance_audit"
    except Exception as _e:
        _ga_note = f"Error: {str(_e)[:80]}"

_diag_row("governance_audit accessible", _ga_ok, _ga_note)

st.markdown("</div>", unsafe_allow_html=True)

# Show full error message if connection failed
if status.get("error"):
    st.markdown(
        f"<div style='background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;"
        f"padding:10px 14px;margin-top:8px;font-size:12px;color:#991B1B;'>"
        f"<strong>Diagnostic error:</strong> {status['error']}"
        f"</div>",
        unsafe_allow_html=True
    )

