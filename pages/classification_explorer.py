import streamlit as st
import pandas as pd
from services.unity_catalog_service import UnityCatalogService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header

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

if not catalog_results:
    st.info("No registered classifications found in the catalog.")
    st.stop()

df   = pd.DataFrame(catalog_results)
tags = df["tag"].unique()

pii_tags   = [t for t in tags if "pii"       in t.lower()]
phi_tags   = [t for t in tags if "phi"       in t.lower()]
other_tags = [t for t in tags if "pii" not in t.lower() and "phi" not in t.lower()]

col_pii, col_phi, col_other = st.columns(3)

def tag_category_card(col, heading, tag_list, accent_color):
    with col:
        st.markdown(
            f"<div class='metric-card' style='border-top:3px solid {accent_color};'>"
            f"<div class='metric-label'>{heading}</div>"
            f"<div class='metric-value mono-val' style='color:{accent_color};font-size:28px;'>{len(tag_list)}</div>"
            f"<div style='margin-top:12px;'>",
            unsafe_allow_html=True
        )
        for t in tag_list:
            count = len(df[df["tag"] == t])
            st.markdown(
                f"<div style='font-size:12px;color:var(--ink);padding:3px 0;border-bottom:1px solid var(--border);'>"
                f"<code class='mono-text' style='background:var(--surface-sunken);padding:2px 6px;border-radius:3px;font-size:11px;'>{t}</code>"
                f"<span class='mono-text' style='color:var(--ink-muted);margin-left:6px;'>{count} column(s)</span>"
                f"</div>",
                unsafe_allow_html=True
            )
        st.markdown("</div></div>", unsafe_allow_html=True)

tag_category_card(col_pii,   "PII Classifications",       pii_tags,   "#7C3AED")
tag_category_card(col_phi,   "PHI Classifications",       phi_tags,   "#DB2777")
tag_category_card(col_other, "Financial / Other Tags",    other_tags, "#0891B2")

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:20px 0;'>", unsafe_allow_html=True)
st.markdown("<div class='section-title'>All Active Tagged Columns</div>", unsafe_allow_html=True)

st.dataframe(
    df[["schema", "table", "column", "tag", "masking_policy", "class_date"]],
    column_config={
        "schema":         st.column_config.TextColumn("Schema"),
        "table":          st.column_config.TextColumn("Table"),
        "column":         st.column_config.TextColumn("Column"),
        "tag":            st.column_config.TextColumn("Active Tag"),
        "masking_policy": st.column_config.TextColumn("Masking Policy"),
        "class_date":     st.column_config.TextColumn("Classification Date"),
    },
    hide_index=True,
    use_container_width=True
)
