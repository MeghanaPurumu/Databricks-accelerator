import streamlit as st
import pandas as pd
from services.unity_catalog_service import UnityCatalogService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header, render_confidence_ring, get_category_color, get_category_badge, get_status_badge

check_permission_page("view_search")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Governance Search</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Search Unity Catalog registered assets, tags, masking rules, and access control policies.</p>",
    unsafe_allow_html=True
)

uc_service   = UnityCatalogService()
search_query = st.text_input(
    "Search catalog assets",
    placeholder="Search by column name, table, schema, or tag (e.g. ssn, PATIENTS, clinical)",
    label_visibility="collapsed"
)


results = uc_service.search_catalog(search_query)

# Render Recent Searches chips above results
st.markdown(
    "<div style='display: flex; gap: 8px; align-items: center; margin-bottom: 16px;'>"
    "<span style='font-size: 11px; font-weight: 600; color: var(--ink-muted); text-transform: uppercase;'>Recent Searches</span>"
    "<span class='mono-text' style='background: var(--surface-sunken); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: var(--ink); cursor: pointer;'>clinical</span>"
    "<span class='mono-text' style='background: var(--surface-sunken); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: var(--ink); cursor: pointer;'>ssn</span>"
    "<span class='mono-text' style='background: var(--surface-sunken); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: var(--ink); cursor: pointer;'>PATIENTS</span>"
    "</div>",
    unsafe_allow_html=True
)

if results:
    st.markdown(
        f"<div style='font-size:13px;color:var(--ink-muted);margin-bottom:12px;'>{len(results)} catalog asset(s) found</div>",
        unsafe_allow_html=True
    )
    
    df_res = pd.DataFrame(results)
    
    # Header row
    hdr = st.columns([4, 3, 2, 3])
    hdr[0].markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;'>Asset Path</div>", unsafe_allow_html=True)
    hdr[1].markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;'>Active Tag</div>", unsafe_allow_html=True)
    hdr[2].markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;'>Status</div>", unsafe_allow_html=True)
    hdr[3].markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);text-transform:uppercase;'>Security Policies</div>", unsafe_allow_html=True)

    for idx, row in df_res.iterrows():
        c_path, c_tag, c_metrics, c_policy = st.columns([4, 3, 2, 3])
        
        # Categorize column sensitivity category mapping
        tag_val = row["tag"] or ""
        cat = "PII" if "pii" in tag_val.lower() else "PHI" if "phi" in tag_val.lower() else "Financial" if "pci" in tag_val.lower() else "Other"
        cat_color = get_category_color(cat)

        # Asset path with left-border category color block
        c_path.markdown(
            f"<div style='border-left: 3px solid {cat_color}; padding-left: 10px; min-height: 24px; display: flex; align-items: center;'>"
            f"<span class='mono-text' style='font-weight:600;'>{row['schema']}.{row['table']}.{row['column']}</span>"
            f"</div>",
            unsafe_allow_html=True
        )

        c_tag.markdown(
            f"<div style='display: flex; align-items: center; gap: 8px; height: 100%;'>"
            f"<code class='mono-text' style='background:var(--surface-sunken); padding:2px 6px; border-radius:3px; font-size:11px;'>{row['tag'] or 'untagged'}</code>"
            f"{get_category_badge(cat)}"
            f"</div>",
            unsafe_allow_html=True
        )

        c_metrics.markdown(
            f"<div style='display: flex; align-items: center; gap: 8px; height: 100%;'>"
            f"{get_status_badge(row['status'])}"
            f"</div>",
            unsafe_allow_html=True
        )

        # Masking and ABAC Policies combined
        policy_text = []
        if row["masking_policy"]:
            policy_text.append(f"Masking: <code class='mono-text'>{row['masking_policy']}</code>")
        if row["abac_policy"]:
            policy_text.append(f"ABAC: <code class='mono-text'>{row['abac_policy']}</code>")
        
        if policy_text:
            c_policy.markdown(
                f"<div style='font-size:11px; color:var(--ink-muted);'>"
                f"{'<br>'.join(policy_text)}"
                f"</div>",
                unsafe_allow_html=True
            )
        else:
            c_policy.markdown("<span style='color:var(--ink-muted); font-size:12px;'>No active policies</span>", unsafe_allow_html=True)
else:
    st.info("No catalog assets matched the search query.")
