import streamlit as st

def get_current_user():
    """
    Extracts the logged-in user details from Databricks environment headers.
    Falls back to simulated user in local session state.
    """
    headers = {}
    try:
        if hasattr(st, "context") and hasattr(st.context, "headers"):
            headers = st.context.headers
    except Exception:
        pass

    user_email = headers.get("X-User-Email") or headers.get("x-user-email")
    
    if user_email:
        role = "Read-only Analyst"
        if "steward" in user_email.lower():
            role = "Governance Steward"
        elif "compliance" in user_email.lower():
            role = "Compliance Officer"
        elif "engineer" in user_email.lower():
            role = "Data Engineer"
            
        return {
            "email": user_email,
            "role": role,
            "is_mock": False
        }
        
    return {
        "email": st.session_state.get("current_user_email", "steward@enterprise.com"),
        "role": st.session_state.get("current_user_role", "Governance Steward"),
        "is_mock": True
    }

