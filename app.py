import sys
import os

# Safe check: if executed via bare python (e.g., 'python app.py'),
# automatically relaunch ourselves inside the Streamlit runner.
if __name__ == "__main__":
    try:
        from streamlit.runtime.scriptrunner import get_script_run_ctx
        if get_script_run_ctx() is None:
            import streamlit.web.cli as stcli
            # Use Databricks Apps PORT environment variable or default to 8501
            port = os.environ.get("PORT", "8501")
            sys.argv = ["streamlit", "run", "app.py", "--server.port", port, "--server.address", "0.0.0.0"]
            sys.exit(stcli.main())
    except Exception:
        pass

import streamlit as st
from config.settings import init_settings
from services.governance_service import GovernanceService
from utils.helpers import render_sidebar_notifications

st.set_page_config(
    page_title="Governance Steward Portal",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state and preload mock data
init_settings()
GovernanceService()

# ---------- Navigation pages ----------
dashboard_page           = st.Page("pages/dashboard.py",               title="Dashboard",                default=True)
review_queue_page        = st.Page("pages/review_queue.py",            title="Review Queue")
orchestrator_page        = st.Page("pages/agent_orchestration.py",     title="Agent Orchestrator")
classification_page      = st.Page("pages/classification_explorer.py", title="Classification Explorer")
search_page              = st.Page("pages/search.py",                  title="Search Assets")
qa_page                  = st.Page("pages/governance_qa.py",           title="Governance Q&A")
audit_page               = st.Page("pages/audit.py",                   title="Audit Logs")
reports_page             = st.Page("pages/reports.py",                 title="Reports & Analytics")
settings_page            = st.Page("pages/settings.py",                title="Settings")

# Group pages into sections to match Databricks sidebar structure (e.g. SQL / Common)
pg = st.navigation({
    "Governance Workbench": [
        dashboard_page,
        review_queue_page,
        orchestrator_page,
        classification_page,
        search_page,
        qa_page
    ],
    "Compliance & Control": [
        audit_page,
        reports_page,
        settings_page
    ]
})

# ---------- Shared sidebar elements ----------
with st.sidebar:
    # Governance branded logo at top of sidebar
    st.markdown(
        """
        <div style="display: flex; align-items: center; gap: 10px; padding: 16px 12px 8px;">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Pillar base -->
                <rect x="14" y="26" width="4" height="3" rx="1" fill="#1E3A8A"/>
                <rect x="9" y="28" width="14" height="2" rx="1" fill="#1E3A8A"/>
                <!-- Center pole -->
                <rect x="15.5" y="8" width="1" height="18" fill="#3B82F6"/>
                <!-- Crossbar -->
                <rect x="6" y="8" width="20" height="1.5" rx="0.75" fill="#1E3A8A"/>
                <!-- Top knob -->
                <circle cx="16" cy="6.5" r="2" fill="#1E3A8A"/>
                <!-- Left pan chain -->
                <line x1="9" y1="9.5" x2="7" y2="17" stroke="#3B82F6" stroke-width="1"/>
                <line x1="9" y1="9.5" x2="11" y2="17" stroke="#3B82F6" stroke-width="1"/>
                <!-- Left pan -->
                <path d="M5.5 17 Q7 20 8.5 17" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1"/>
                <!-- Right pan chain -->
                <line x1="23" y1="9.5" x2="21" y2="17" stroke="#3B82F6" stroke-width="1"/>
                <line x1="23" y1="9.5" x2="25" y2="17" stroke="#3B82F6" stroke-width="1"/>
                <!-- Right pan -->
                <path d="M19.5 17 Q21 20 22.5 17" fill="#BFDBFE" stroke="#3B82F6" stroke-width="1"/>
            </svg>
            <span style="font-weight: 700; font-size: 15px; color: #1E3A8A; letter-spacing: -0.3px; font-family: 'Inter', sans-serif;">Governance</span>
        </div>
        """,
        unsafe_allow_html=True
    )

    # New Action button
    st.markdown(
        """
        <div style="padding: 4px 12px 12px;">
            <div style="background: linear-gradient(135deg,#1E3A8A,#3B82F6); color:#fff; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;">
                <span style="font-size: 16px; font-weight: 300; line-height: 1;">+</span> New Action
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.04em;text-transform:uppercase;padding:0 12px 6px;'>Active Session</div>", unsafe_allow_html=True)

    role_options = ["Governance Steward", "Compliance Officer", "Data Engineer", "Read-only Analyst"]
    selected_role = st.selectbox(
        "Role",
        options=role_options,
        index=role_options.index(st.session_state.current_user_role),
        label_visibility="collapsed"
    )

    if selected_role != st.session_state.current_user_role:
        st.session_state.current_user_role = selected_role
        st.session_state.current_user_email = (
            "steward@enterprise.com"   if selected_role == "Governance Steward"  else
            "compliance@enterprise.com" if selected_role == "Compliance Officer" else
            "engineer@enterprise.com"   if selected_role == "Data Engineer"      else
            "analyst@enterprise.com"
        )
        st.rerun()

    st.markdown(
        f"<div class='mono-text' style='font-size:11px;color:var(--ink-muted);padding:4px 12px;'>"
        f"{st.session_state.current_user_email}</div>",
        unsafe_allow_html=True
    )
    st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:8px 12px;'>", unsafe_allow_html=True)

    render_sidebar_notifications()

pg.run()
