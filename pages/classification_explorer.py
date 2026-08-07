import streamlit as st
import pandas as pd
from services.unity_catalog_service import UnityCatalogService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header
from utils.db import get_connection_status

check_permission_page("view_search")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Classification Explorer</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Browse active sensitive data tags registered across Unity Catalog &mdash; PII, PHI, Financial.</p>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 20px;'>", unsafe_allow_html=True)

uc_service     = UnityCatalogService()
catalog_results = uc_service.search_catalog("")

# ── Connection mode indicator ─────────────────────────────────────────────────
conn = get_connection_status()
is_live = conn.get("connected", False)
live_mode = st.session_state.get("uc_live_mode", False)
src_label = "Live Databricks Catalog" if (is_live and live_mode) else "Databricks (Rule Classifier)" if is_live else "Offline Fallback"
src_color = "#0F9D58" if (is_live and live_mode) else "#1A73E8" if is_live else "#F59E0B"

if not catalog_results:
    st.info("No registered classifications found in the catalog.")
    st.stop()

df = pd.DataFrame(catalog_results)

# ── Ensure tag column is populated ───────────────────────────────────────────
# Apply rule-based tags to any rows that still have empty tags
from services.unity_catalog_service import _classify_column_tag

def _fill_tag(row):
    if not row["tag"] or str(row["tag"]).strip().lower() in ["", "none", "unclassified"]:
        derived_tag, _ = _classify_column_tag(row["column"])
        return derived_tag
    return row["tag"]

df["tag"] = df.apply(_fill_tag, axis=1)

# ── Categorize tags ───────────────────────────────────────────────────────────
pii_mask       = df["tag"].str.lower().str.contains("pii",       na=False)
phi_mask       = df["tag"].str.lower().str.contains("phi",       na=False)
financial_mask = df["tag"].str.lower().str.contains("financial", na=False)

pii_df       = df[pii_mask]
phi_df       = df[phi_mask]
financial_df = df[financial_mask]
unclassified = df[~pii_mask & ~phi_mask & ~financial_mask]

total_tagged = len(df[df["tag"].str.len() > 0])
total_rows   = len(df)
classified_pct = (total_tagged / total_rows * 100) if total_rows else 0

# ── Summary metrics row ───────────────────────────────────────────────────────
m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Total Columns",    total_rows)
m2.metric("PII Columns",      len(pii_df))
m3.metric("PHI Columns",      len(phi_df))
m4.metric("Financial Columns",len(financial_df))
m5.metric("Classified %",     f"{classified_pct:.0f}%")

st.markdown(
    f"<div style='font-size:11px; color:{src_color}; margin-top:-8px; margin-bottom:16px;'>"
    f"&#9679; Data source: <strong>{src_label}</strong></div>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:4px 0 20px;'>", unsafe_allow_html=True)

# ── Category cards ────────────────────────────────────────────────────────────
col_pii, col_phi, col_other = st.columns(3)

def tag_category_card(col, heading, tag_df, accent_color):
    tags = tag_df["tag"].unique() if not tag_df.empty else []
    with col:
        st.markdown(
            f"<div class='metric-card' style='border-top:3px solid {accent_color};background:var(--surface);border:1px solid var(--border);border-top:3px solid {accent_color};border-radius:6px;padding:16px;'>"
            f"<div style='font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.05em;'>{heading}</div>"
            f"<div style='font-size:28px;font-weight:700;color:{accent_color};margin:4px 0 12px;'>{len(tags)}</div>",
            unsafe_allow_html=True
        )
        for t in sorted(tags):
            count = len(tag_df[tag_df["tag"] == t])
            st.markdown(
                f"<div style='font-size:12px;color:var(--ink);padding:4px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;'>"
                f"<code class='mono-text' style='background:var(--surface-sunken);padding:2px 6px;border-radius:3px;font-size:11px;'>{t}</code>"
                f"<span class='mono-text' style='color:var(--ink-muted);font-size:11px;'>{count} col(s)</span>"
                f"</div>",
                unsafe_allow_html=True
            )
        st.markdown("</div>", unsafe_allow_html=True)

tag_category_card(col_pii,   "PII Classifications",       pii_df,       "#7C3AED")
tag_category_card(col_phi,   "PHI Classifications",       phi_df,       "#DB2777")
tag_category_card(col_other, "Financial / Other Tags",    financial_df, "#0891B2")

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:20px 0;'>", unsafe_allow_html=True)
st.markdown("<div class='section-title'>All Active Tagged Columns</div>", unsafe_allow_html=True)

# Build display DataFrame with all needed columns
display_cols = ["schema", "table", "column", "tag", "masking_policy", "class_date"]
# Add status column if present
if "status" in df.columns:
    display_cols.append("status")

# Filter to only show classified columns in the main table (optional toggle)
show_all = st.checkbox("Show all columns (including unclassified)", value=False)
display_df = df if show_all else df[df["tag"].str.len() > 0]

st.dataframe(
    display_df[display_cols],
    column_config={
        "schema":         st.column_config.TextColumn("Schema"),
        "table":          st.column_config.TextColumn("Table"),
        "column":         st.column_config.TextColumn("Column"),
        "tag":            st.column_config.TextColumn("Active Tag"),
        "masking_policy": st.column_config.TextColumn("Masking Policy"),
        "class_date":     st.column_config.TextColumn("Classification Date"),
        "status":         st.column_config.TextColumn("Status"),
    },
    hide_index=True,
    use_container_width=True
)

if not show_all and len(unclassified):
    st.caption(f"{len(unclassified)} unclassified column(s) hidden. Toggle checkbox above to show all.")
