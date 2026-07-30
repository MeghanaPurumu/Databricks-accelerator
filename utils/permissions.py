import streamlit as st
from utils.auth import get_current_user

# Role access matrix
# True: Authorized, False: Unauthorized
ROLE_PERMISSIONS = {
    "Governance Steward": {
        "view_dashboard": True,
        "view_queue": True,
        "approve_reject": True,
        "view_audit": True,
        "view_search": True,
        "ask_qa": True,
        "manage_settings": True,
        "view_orchestrator": True,
        "trigger_orchestrator": True
    },
    "Compliance Officer": {
        "view_dashboard": True,
        "view_queue": True,
        "approve_reject": True,
        "view_audit": True,
        "view_search": True,
        "ask_qa": True,
        "manage_settings": True,
        "view_orchestrator": True,
        "trigger_orchestrator": True
    },
    "Data Engineer": {
        "view_dashboard": True,
        "view_queue": True,
        "approve_reject": False,  # Engineers cannot approve/reject classifications
        "view_audit": True,
        "view_search": True,
        "ask_qa": True,
        "manage_settings": False,
        "view_orchestrator": True,
        "trigger_orchestrator": True
    },
    "Read-only Analyst": {
        "view_dashboard": True,
        "view_queue": True,
        "approve_reject": False,
        "view_audit": True,
        "view_search": True,
        "ask_qa": True,
        "manage_settings": False,
        "view_orchestrator": True,
        "trigger_orchestrator": False
    }
}

def has_permission(action: str) -> bool:
    """Checks if the current user has permission to perform a specific action."""
    user = get_current_user()
    role = user["role"]
    role_rules = ROLE_PERMISSIONS.get(role, {})
    return role_rules.get(action, False)

def check_permission_page(action: str):
    """Page-level check that stops execution and displays an error if the user is unauthorized."""
    if not has_permission(action):
        st.error(" Access Denied: You do not have permission to view this page or perform this action.")
        st.info(f"Your current role: **{get_current_user()['role']}**")
        st.stop()

