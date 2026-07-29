import streamlit as st

# Application Defaults
DEFAULT_CONFIDENCE_THRESHOLD = 0.70
DEFAULT_AUTO_APPROVAL_THRESHOLD = 0.95
DEFAULT_REFRESH_INTERVAL = 30  # seconds
DEFAULT_SCHEMA = "clinical"

def init_settings():
    """Initialize app-wide settings in Streamlit session state if they do not exist."""
    if "confidence_threshold" not in st.session_state:
        st.session_state.confidence_threshold = DEFAULT_CONFIDENCE_THRESHOLD
    if "auto_approval_threshold" not in st.session_state:
        st.session_state.auto_approval_threshold = DEFAULT_AUTO_APPROVAL_THRESHOLD
    if "refresh_interval" not in st.session_state:
        st.session_state.refresh_interval = DEFAULT_REFRESH_INTERVAL
    if "default_schema" not in st.session_state:
        st.session_state.default_schema = DEFAULT_SCHEMA
    if "notifications_enabled" not in st.session_state:
        st.session_state.notifications_enabled = True
    if "current_user_role" not in st.session_state:
        st.session_state.current_user_role = "Governance Steward"
    if "current_user_email" not in st.session_state:
        st.session_state.current_user_email = "steward@enterprise.com"

