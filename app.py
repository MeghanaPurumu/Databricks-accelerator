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
    page_icon=None,
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
                <path d="M16 3L5 8.2V15.5C5 21.6 9.7 27.2 16 29C22.3 27.2 27 21.6 27 15.5V8.2L16 3Z" fill="url(#sidebarShieldGrad)" />
                <path d="M12 11H20V13H12V11Z" fill="#FFFFFF" />
                <path d="M12 15H20V17H12V15Z" fill="#FFFFFF" />
                <path d="M12 19H20V21H12V19Z" fill="#FFFFFF" />
                <circle cx="21" cy="21" r="5" fill="#0F9D58" />
                <path d="M19.5 21L20.5 22L22.5 20" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <defs>
                    <linearGradient id="sidebarShieldGrad" x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#1E3A8A"/>
                        <stop offset="1" stop-color="#3B82F6"/>
                    </linearGradient>
                </defs>
            </svg>
            <span style="font-weight: 800; font-size: 16px; color: #1E3A8A; letter-spacing: -0.5px; font-family: 'Inter', sans-serif;">Governance</span>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    # Databricks style "+ New" button mockup at the top
    st.markdown(
        """
        <div style="padding: 4px 12px 12px;">
            <div style="background-color: #FCE8E6; color: #C5221F; padding: 8px 16px; border-radius: 18px; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; border: 1px solid #FAD2CF;">
                <span style="font-size: 16px; font-weight: 400; line-height: 1;">+</span> New Action
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
