import streamlit as st

def apply_custom_css():
    """Injects Databricks style design tokens and styling rules."""
    st.markdown("""
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        :root {
            --bg: #FFFFFF;
            --surface: #FFFFFF;
            --surface-sunken: #F9FAFB;
            --border: #E2E5ED;
            --ink: #111827;
            --ink-muted: #64748B;
            --primary: #1A73E8;
            --primary-deep: #1557B0;
            --pii: #7C3AED;
            --phi: #DB2777;
            --financial: #0891B2;
            --success: #0F9D58;
            --warning: #F4B400;
            --danger: #DB4437;
        }

        html, body, [class*="css"] {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }

        .stApp {
            background-color: var(--bg);
            color: var(--ink);
        }

        /* Monospace values */
        .mono-text, .mono-val {
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important;
            font-size: 13px !important;
        }

        /* Databricks styled metric card */
        .db-metric-card {
            background: var(--surface);
            border: none;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04);
            transition: box-shadow 0.15s ease;
        }
        .db-metric-card:hover {
            box-shadow: 0 3px 10px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06);
        }
        .db-metric-label {
            font-size: 12px;
            color: var(--ink-muted);
            font-weight: 500;
            margin-bottom: 4px;
        }
        .db-metric-value {
            font-size: 22px;
            font-weight: 600;
            color: var(--ink);
            line-height: 1.2;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .db-metric-sub {
            font-size: 11px;
            color: var(--ink-muted);
            margin-top: 4px;
        }

        /* Status badges */
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
        }

        .badge-approved {
            background-color: #E6F4EA;
            color: var(--success);
        }

        .badge-pending {
            background-color: #FEF7E0;
            color: #B06000;
        }

        .badge-rejected {
            background-color: #FCE8E6;
            color: var(--danger);
        }

        .badge-escalated {
            background-color: var(--surface-sunken);
            color: var(--ink-muted);
        }

        /* Category indicator chips */
        .cat-pill {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .cat-pii { background: #F3E8FF; color: var(--pii); }
        .cat-phi { background: #FCE7F3; color: var(--phi); }
        .cat-financial { background: #CFFAFE; color: var(--financial); }

        /* Left-edge color indicator bar for list rows */
        .list-row-indicator {
            width: 4px;
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
            border-top-left-radius: 6px;
            border-bottom-left-radius: 6px;
        }

        /* Activity card */
        .activity-card {
            background: var(--surface);
            border: none;
            border-left: 3px solid var(--primary);
            border-radius: 6px;
            padding: 14px 18px;
            margin-bottom: 10px;
            position: relative;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }

        /* Section title */
        .section-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--ink);
            margin-bottom: 16px;
            padding-bottom: 4px;
        }

        /* Panel box */
        .panel-box {
            background: var(--surface) !important;
            border: none !important;
            border-radius: 8px !important;
            padding: 20px !important;
            box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04) !important;
        }

        /* Priority labels */
        .priority-critical { color: var(--danger); font-weight: 600; }
        .priority-high     { color: #D97706; font-weight: 600; }
        .priority-medium   { color: var(--primary); font-weight: 600; }
        .priority-low      { color: var(--ink-muted); font-weight: 500; }

        /* Timeline */
        .timeline-item {
            border-left: 2px solid var(--primary);
            padding: 8px 0 8px 16px;
            margin-bottom: 6px;
            font-size: 13px;
        }

        /* Streamlit widget overrides for Databricks appearance */
        .stButton > button {
            border-radius: 4px;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.15s ease;
        }

        [data-testid="stSidebar"] {
            background-color: #F9FAFB;
        }

        [data-testid="stSidebarNavItems"] a {
            font-size: 13px;
            font-weight: 500;
            color: #374151 !important;
            padding: 6px 12px !important;
            border-radius: 4px !important;
            margin: 2px 8px !important;
            display: flex !important;
            align-items: center !important;
            text-decoration: none !important;
        }
        [data-testid="stSidebarNavItems"] a:hover {
            background-color: #E2E8F0 !important;
            color: var(--primary) !important;
        }
        [data-testid="stSidebarNavItems"] a[aria-current="page"],
        [data-testid="stSidebarNavItems"] a[data-selected="true"] {
            background-color: #E8F0FE !important;
            color: var(--primary) !important;
            font-weight: 600 !important;
        }

        /* DataFrame monospace cell overrides */
        [data-testid="stDataFrame"] div, [data-testid="stTable"] td, [data-testid="stDataFrame"] td {
            font-family: 'JetBrains Mono', 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
        }

        /* ── Suppress ALL Streamlit-generated border lines ─────────────────
           Streamlit 1.3x wraps column children in stVerticalBlockBorderWrapper
           and various other elements with borders/outlines we don't want.     */
        [data-testid="stVerticalBlockBorderWrapper"],
        [data-testid="stVerticalBlock"],
        [data-testid="stHorizontalBlock"],
        [data-testid="stColumn"],
        [data-testid="column"],
        [data-testid="stElementContainer"] {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            outline: none !important;
        }
        [data-testid="column"] > div {
            border: none !important;
            background: transparent !important;
        }
        /* Suppress metric card internal Streamlit borders */
        [data-testid="stMetric"] {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
        }
        /* Remove Streamlit's default block border */
        .stMarkdown, .element-container {
            border: none !important;
        }
        </style>
    <!-- governance-css-v4 -->
    """, unsafe_allow_html=True)



def render_confidence_ring(score: float, size: int = 32) -> str:
    """Renders a custom SVG arc circle representing the AI confidence score."""
    pct = score * 100
    radius = 12
    circ = 2 * 3.14159265 * radius
    offset = circ * (1.0 - score)
    
    if score >= 0.90:
        stroke_color = "var(--success)"
    elif score >= 0.70:
        stroke_color = "var(--warning)"
    else:
        stroke_color = "var(--danger)"
        
    return f"""
    <svg width="{size}" height="{size}" viewBox="0 0 32 32" style="transform: rotate(-90deg); display: inline-block; vertical-align: middle;">
        <circle cx="16" cy="16" r="{radius}" fill="none" stroke="var(--border)" stroke-width="3" />
        <circle cx="16" cy="16" r="{radius}" fill="none" stroke="{stroke_color}" stroke-width="3"
                stroke-dasharray="{circ}" stroke-dashoffset="{offset}" stroke-linecap="round" />
    </svg>
    """


def get_category_color(category: str) -> str:
    """Returns the CSS color value for a sensitivity category."""
    cat = category.lower()
    if "pii" in cat:
        return "var(--pii)"
    elif "phi" in cat:
        return "var(--phi)"
    elif "financial" in cat or "pci" in cat:
        return "var(--financial)"
    return "var(--ink-muted)"


def get_category_badge(category: str) -> str:
    """Returns a styled category badge."""
    cat_lower = category.lower()
    if "pii" in cat_lower:
        return '<span class="cat-pill cat-pii">PII</span>'
    elif "phi" in cat_lower:
        return '<span class="cat-pill cat-phi">PHI</span>'
    elif "financial" in cat_lower or "pci" in cat_lower:
        return '<span class="cat-pill cat-financial">Financial</span>'
    return f'<span class="cat-pill" style="background:var(--border);color:var(--ink-muted);">{category}</span>'


def render_top_header():
    """Applies shared CSS. Header bar removed — sidebar provides all branding."""
    apply_custom_css()

def render_sidebar_notifications():
    """Renders a notification panel inside the sidebar."""
    if not st.session_state.get("notifications_enabled", True):
        return

    pending_items = st.session_state.get("pending_reviews", {})
    if not pending_items:
        return

    items_list = list(pending_items.values())
    new_pending = [i for i in items_list if i.status == "PENDING"]
    recently_approved = [i for i in items_list if i.status == "APPROVED"]
    high_priority = [i for i in items_list if i.status == "PENDING" and i.confidence_score < 0.70]

    with st.sidebar.expander(f"Notifications ({len(new_pending)})", expanded=True):
        if high_priority:
            st.markdown("**High Priority Alerts**")
            for item in high_priority[:2]:
                st.markdown(
                    f"<div style='font-size:12px;color:var(--danger);padding:4px 0;border-bottom:1px solid #FEE2E2;'>"
                    f"<span class='mono-text'>{item.column_name}</span> &mdash; {item.confidence_score*100:.0f}% confidence"
                    f"</div>",
                    unsafe_allow_html=True
                )
            st.markdown("")

        if new_pending:
            st.markdown("**Awaiting Review**")
            for item in new_pending[:4]:
                st.markdown(
                    f"<div class='mono-text' style='font-size:12px;color:var(--ink);padding:3px 0;'>"
                    f"{item.table_name}.{item.column_name}"
                    f"</div>",
                    unsafe_allow_html=True
                )

        if recently_approved:
            st.markdown("**Recently Approved**")
            for item in recently_approved[:2]:
                st.markdown(
                    f"<div style='font-size:12px;color:var(--success);padding:3px 0;'>"
                    f"<span class='mono-text'>{item.column_name}</span> &rarr; <span class='mono-text'>{item.suggested_tag}</span>"
                    f"</div>",
                    unsafe_allow_html=True
                )


def get_status_badge(status: str) -> str:
    """Returns a clean HTML badge for a given status string."""
    s = status.lower()
    if "pending" in s:
        return '<span class="badge badge-pending">Pending Review</span>'
    elif "classified" in s and "un" not in s:
        return '<span class="badge badge-approved">Classified</span>'
    elif "approve" in s:
        return '<span class="badge badge-approved">Approved</span>'
    elif "reject" in s:
        return '<span class="badge badge-rejected">Rejected</span>'
    elif "escalat" in s:
        return '<span class="badge badge-escalated">Escalated</span>'
    elif "unclassified" in s:
        return '<span class="badge badge-escalated">Unclassified</span>'
    return f'<span class="badge">{status}</span>'


def format_confidence(score: float) -> str:
    """Returns confidence as a percentage string."""
    return f"{score * 100:.1f}%"


def priority_badge(priority: str) -> str:
    """Returns a styled priority label."""
    cls_map = {
        "critical": "priority-critical",
        "high": "priority-high",
        "medium": "priority-medium",
        "low": "priority-low"
    }
    cls = cls_map.get(priority.lower(), "priority-low")
    return f'<span class="{cls}">{priority}</span>'
