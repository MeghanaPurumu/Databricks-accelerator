import streamlit as st
from services.qa_service import QAService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header

check_permission_page("ask_qa")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Governance Q&amp;A</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Ask governance questions about your data catalog, classification rules, and compliance obligations.</p>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 20px;'>", unsafe_allow_html=True)

qa_service = QAService()

if "qa_messages" not in st.session_state:
    st.session_state.qa_messages = []

# Suggested questions
suggested = [
    "Which columns are classified as PII in clinical?",
    "What is the approval SLA for PHI columns?",
    "List all columns pending classification in the financial domain.",
    "Who approved the last 5 governance decisions?",
    "What ABAC policies apply to columns tagged as PII?"
]

st.markdown("<div class='section-title'>Suggested Questions</div>", unsafe_allow_html=True)
btn_cols = st.columns(len(suggested))
for i, q in enumerate(suggested):
    if btn_cols[i].button(q, key=f"sug_{i}", use_container_width=True):
        st.session_state.qa_messages.append({"role": "user", "content": q})
        response = qa_service.ask(q)
        st.session_state.qa_messages.append({"role": "assistant", "content": response})
        st.rerun()

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0;'>", unsafe_allow_html=True)

# Custom chat bubble renderer
def render_chat_bubble(role: str, content: str):
    if role == "user":
        st.markdown(
            f"<div style='display: flex; justify-content: flex-end; margin-bottom: 12px;'>"
            f"<div style='background-color: var(--surface-sunken); color: var(--ink); padding: 12px 16px; border-radius: 8px 8px 0 8px; max-width: 70%; font-size: 13px; border: 1px solid var(--border);'>"
            f"{content}"
            f"</div>"
            f"</div>",
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            f"<div style='display: flex; justify-content: flex-start; margin-bottom: 12px;'>"
            f"<div style='background-color: var(--surface); color: var(--ink); padding: 12px 16px; border-radius: 8px 8px 8px 0; max-width: 70%; font-size: 13px; border: 1px solid var(--border); border-left: 3px solid var(--primary);'>"
            f"{content}"
            f"</div>"
            f"</div>",
            unsafe_allow_html=True
        )

# Render conversation history using clean bubbles
for msg in st.session_state.qa_messages:
    render_chat_bubble(msg["role"], msg["content"])

# Chat input
if prompt := st.chat_input("Ask a governance question..."):
    st.session_state.qa_messages.append({"role": "user", "content": prompt})
    render_chat_bubble("user", prompt)

    with st.spinner("Querying governance agent..."):
        response = qa_service.ask(prompt)
        
    render_chat_bubble("assistant", response)
    st.session_state.qa_messages.append({"role": "assistant", "content": response})
    st.rerun()
