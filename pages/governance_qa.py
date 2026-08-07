import streamlit as st
import time
from services.qa_service import QAService
from utils.permissions import check_permission_page
from utils.helpers import render_top_header
from utils.db import get_connection_status

check_permission_page("ask_qa")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Governance Q&amp;A</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Ask governance questions about your data catalog, classification rules, and compliance obligations.</p>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 16px;'>", unsafe_allow_html=True)

qa_service = QAService()

# ── Connection & Model Status Banner ─────────────────────────────────────────
conn = get_connection_status()
is_live = conn.get("connected", False)
model_name = st.session_state.get("qa_model_name", "Initializing...")
last_live_ts = st.session_state.get("qa_last_live_ts")
last_live_str = last_live_ts.strftime("%Y-%m-%d %H:%M:%S") if last_live_ts else "Not yet queried"
last_query_ms = st.session_state.get("qa_last_query_ms")
timing_str = f"{last_query_ms:.0f}ms" if last_query_ms else "—"

if is_live:
    status_color = "#0F9D58"
    status_icon  = "●"
    status_label = "Live Databricks Agent"
    model_display = model_name if model_name and model_name != "Initializing..." else qa_service.MODEL_DISPLAY
else:
    status_color = "#F59E0B"
    status_icon  = "●"
    status_label = "Fallback Mode (Rule Engine)"
    model_display = "Rule-Based Engine (No Databricks Connection)"

st.markdown(
    f"""
    <div style='display:flex; align-items:center; justify-content:space-between;
                background:var(--surface-sunken); border:1px solid var(--border);
                border-radius:6px; padding:10px 16px; margin-bottom:16px;'>
        <div style='display:flex; align-items:center; gap:16px;'>
            <div style='display:flex; align-items:center; gap:6px;'>
                <span style='color:{status_color}; font-size:10px;'>{status_icon}</span>
                <span style='font-size:12px; font-weight:600; color:var(--ink);'>{status_label}</span>
            </div>
            <div style='font-size:11px; color:var(--ink-muted);'>
                Model: <code style='background:var(--border); padding:1px 5px; border-radius:3px; font-size:10px;'>{model_display}</code>
            </div>
        </div>
        <div style='display:flex; align-items:center; gap:20px;'>
            <div style='text-align:right;'>
                <div style='font-size:10px; color:var(--ink-muted); text-transform:uppercase; font-weight:600;'>Last Live</div>
                <div style='font-size:11px; color:var(--ink); font-family: monospace;'>{last_live_str}</div>
            </div>
            <div style='text-align:right;'>
                <div style='font-size:10px; color:var(--ink-muted); text-transform:uppercase; font-weight:600;'>Last Response Time</div>
                <div style='font-size:11px; color:var(--ink); font-family: monospace;'>{timing_str}</div>
            </div>
        </div>
    </div>
    """,
    unsafe_allow_html=True
)

if "qa_messages" not in st.session_state:
    st.session_state.qa_messages = []

# ── Suggested Questions ───────────────────────────────────────────────────────
suggested = [
    "Which columns are classified as PII in clinical?",
    "What is the approval SLA for PHI columns?",
    "List all columns pending classification in the financial domain.",
    "Who approved the last 5 governance decisions?",
    "What ABAC policies apply to columns tagged as PII?",
    "When was the last live connection to Databricks?",
    "How long did the last query take to run?"
]

st.markdown("<div class='section-title'>Suggested Questions</div>", unsafe_allow_html=True)
btn_row1 = st.columns(4)
btn_row2 = st.columns(3)
all_btn_cols = btn_row1 + btn_row2

for i, q in enumerate(suggested):
    if i < len(all_btn_cols):
        if all_btn_cols[i].button(q, key=f"sug_{i}", use_container_width=True):
            st.session_state.qa_messages.append({"role": "user", "content": q})
            t0 = time.time()
            response = qa_service.ask(q)
            elapsed = (time.time() - t0) * 1000
            st.session_state.qa_messages.append({
                "role": "assistant",
                "content": response,
                "elapsed_ms": elapsed
            })
            st.rerun()

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0;'>", unsafe_allow_html=True)


# ── Chat bubble renderer ──────────────────────────────────────────────────────
def render_chat_bubble(role: str, content: str, elapsed_ms: float = None):
    if role == "user":
        st.markdown(
            f"<div style='display: flex; justify-content: flex-end; margin-bottom: 12px;'>"
            f"<div style='background-color: var(--surface-sunken); color: var(--ink); "
            f"padding: 12px 16px; border-radius: 8px 8px 0 8px; max-width: 70%; "
            f"font-size: 13px; border: 1px solid var(--border);'>"
            f"{content}"
            f"</div>"
            f"</div>",
            unsafe_allow_html=True
        )
    else:
        timing_badge = ""
        if elapsed_ms is not None:
            color = "#0F9D58" if elapsed_ms < 2000 else "#F59E0B" if elapsed_ms < 5000 else "#DB4437"
            timing_badge = (
                f"<div style='margin-top:8px; text-align:right;'>"
                f"<span style='font-size:10px; color:{color}; font-family:monospace; "
                f"background:var(--surface-sunken); padding:2px 6px; border-radius:3px;'>"
                f"Response: {elapsed_ms:.0f}ms</span>"
                f"</div>"
            )
        st.markdown(
            f"<div style='display: flex; justify-content: flex-start; margin-bottom: 12px;'>"
            f"<div style='background-color: var(--surface); color: var(--ink); "
            f"padding: 12px 16px; border-radius: 8px 8px 8px 0; max-width: 75%; "
            f"font-size: 13px; border: 1px solid var(--border); border-left: 3px solid var(--primary);'>"
            f"{content}"
            f"{timing_badge}"
            f"</div>"
            f"</div>",
            unsafe_allow_html=True
        )


# ── Conversation history ──────────────────────────────────────────────────────
for msg in st.session_state.qa_messages:
    render_chat_bubble(
        msg["role"],
        msg["content"],
        elapsed_ms=msg.get("elapsed_ms") if msg["role"] == "assistant" else None
    )

# ── Chat input ────────────────────────────────────────────────────────────────
if prompt := st.chat_input("Ask a governance question..."):
    st.session_state.qa_messages.append({"role": "user", "content": prompt})
    render_chat_bubble("user", prompt)

    with st.spinner("Querying governance agent..."):
        t0 = time.time()
        response = qa_service.ask(prompt)
        elapsed = (time.time() - t0) * 1000

    render_chat_bubble("assistant", response, elapsed_ms=elapsed)
    st.session_state.qa_messages.append({
        "role": "assistant",
        "content": response,
        "elapsed_ms": elapsed
    })
    st.rerun()
