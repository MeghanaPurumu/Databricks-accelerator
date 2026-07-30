import streamlit as st
import time
import pandas as pd
from datetime import datetime
from utils.permissions import check_permission_page, has_permission
from utils.helpers import render_top_header

check_permission_page("view_orchestrator")
render_top_header()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>Agent Orchestrator & Controller</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);'>Master console for triggering inbound pipelines, auditing multi-agent execution context, and inspecting schema change events.</p>",
    unsafe_allow_html=True
)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0 20px;'>", unsafe_allow_html=True)

# Session state initialization for orchestrator
if "pipeline_status" not in st.session_state:
    st.session_state.pipeline_status = "IDLE"
if "pipeline_logs" not in st.session_state:
    st.session_state.pipeline_logs = [
        "[INFO] System ready. Awaiting trigger hook...",
        "[INFO] Workspace client connected successfully to active Unity Catalog metastore."
    ]
if "event_triggers" not in st.session_state:
    st.session_state.event_triggers = [
        {
            "Event ID": "EVT-8092",
            "Event Type": "SCHEMA_CHANGE",
            "Target Table": "clinical.PATIENTS",
            "Details": "New column 'tax_identifier' added to table schema.",
            "Action Taken": "Triggered Supervisor Agent",
            "Status": "PROCESSED",
            "Timestamp": "2026-07-29 10:15:30"
        },
        {
            "Event ID": "EVT-8093",
            "Event Type": "NEW_DATA_INGESTION",
            "Target Table": "revenue_cycle.CLAIMS",
            "Details": "Inbound claims file processed via Autoloader schema inference.",
            "Action Taken": "Triggered Classification Worker",
            "Status": "PROCESSED",
            "Timestamp": "2026-07-29 14:02:11"
        }
    ]

# Layout for Orchestrator Controller
col_left, col_right = st.columns([5, 7])

with col_left:
    st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Pipeline Control Panel</div>", unsafe_allow_html=True)
    st.markdown(
        f"""
        <div style='padding: 10px 14px; background: var(--surface-sunken); border-radius: 6px; margin-bottom: 16px; border: 1px solid var(--border);'>
            <div style='font-size: 11px; text-transform: uppercase; color: var(--ink-muted); font-weight: 600; letter-spacing: 0.05em;'>Active Pipeline Status</div>
            <div style='font-size: 18px; font-weight: 700; color: {"#10B981" if st.session_state.pipeline_status == "COMPLETED" else "#F59E0B" if st.session_state.pipeline_status != "IDLE" else "var(--ink)"}; margin-top: 4px; display: flex; align-items: center; gap: 8px;'>
                <span style='width: 10px; height: 10px; border-radius: 50%; background: {"#10B981" if st.session_state.pipeline_status == "COMPLETED" else "#F59E0B" if st.session_state.pipeline_status != "IDLE" else "#6B7280"}; display: inline-block;'></span>
                {st.session_state.pipeline_status}
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    can_trigger = has_permission("trigger_orchestrator")

    # Ingestion Trigger Button
    if st.button("🚀 Trigger Inbound Data Ingestion", use_container_width=True, disabled=not can_trigger):
        st.session_state.pipeline_status = "INGESTING"
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Ingestion Engine] Triggered data ingestion workflow.")
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Ingestion Engine] Scanning Autoloader bucket 's3://clinical-drop/raw/'...")
        st.rerun()

    # Schema watch trigger button
    if st.button("🔍 Simulate Schema-Watch Event Trigger", use_container_width=True, disabled=not can_trigger):
        st.session_state.pipeline_status = "EVENT_DETECTED"
        new_event = {
            "Event ID": f"EVT-{time.strftime('%M%S')}",
            "Event Type": "SCHEMA_CHANGE",
            "Target Table": "clinical.CLINICAL_NOTES",
            "Details": "New column 'practitioner_signature' added to table.",
            "Action Taken": "Triggered Supervisor Agent",
            "Status": "PENDING",
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        st.session_state.event_triggers.insert(0, new_event)
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Schema Watch] Event EVT-{time.strftime('%M%S')} captured via catalog event hooks.")
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Schema Watch] Schema modification detected on clinical.CLINICAL_NOTES.")
        st.rerun()

    # Supervisor Orchestration trigger
    if st.button("🤖 Run Multi-Agent Supervisor Pipeline", use_container_width=True, disabled=not can_trigger):
        st.session_state.pipeline_status = "ORCHESTRATING_AGENTS"
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Supervisor] Starting orchestration workflow...")
        st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Supervisor] Triggering 'Detection Worker Agent'...")
        st.rerun()

    st.markdown("</div>", unsafe_allow_html=True)

    # Agent Status Cards
    st.markdown("<div class='panel-box' style='margin-top: 16px;'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Active Worker Agents</div>", unsafe_allow_html=True)

    agents = [
        {"name": "Detection Worker Agent", "desc": "Native Unity Catalog Classifiers", "status": "ACTIVE", "color": "#10B981"},
        {"name": "Ontology Lookup Agent", "desc": "Genie Business Glossary Service", "status": "STANDBY", "color": "#6B7280"},
        {"name": "Similarity Worker Agent", "desc": "Vector Search catalog matcher", "status": "STANDBY", "color": "#6B7280"},
        {"name": "Supervisor Agent", "desc": "Multi-agent consensus decider", "status": "ACTIVE", "color": "#10B981"}
    ]

    for agent in agents:
        st.markdown(
            f"""
            <div style='padding: 8px 12px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;'>
                <div>
                    <div style='font-size:13px; font-weight:600; color:var(--ink);'>{agent['name']}</div>
                    <div style='font-size:11px; color:var(--ink-muted);'>{agent['desc']}</div>
                </div>
                <div style='font-size: 10px; font-weight:600; color: {agent['color']}; border: 1px solid {agent['color']}; padding: 2px 6px; border-radius: 12px;'>
                    {agent['status']}
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )
    st.markdown("</div>", unsafe_allow_html=True)

with col_right:
    st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
    st.markdown("<div class='section-title'>Orchestrator Logs & Execution Trace</div>", unsafe_allow_html=True)
    
    # Render execution states
    if st.session_state.pipeline_status == "INGESTING":
        with st.spinner("Processing inbound dataset ingestion..."):
            time.sleep(1.5)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Ingestion Engine] File read successful. 120,539 rows loaded into raw bronze layer.")
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Ingestion Engine] Invoking Schema Watch Agent.")
            st.session_state.pipeline_status = "ORCHESTRATING_AGENTS"
            st.rerun()

    elif st.session_state.pipeline_status == "EVENT_DETECTED":
        with st.spinner("Processing event-driven schema modification hooks..."):
            time.sleep(1.5)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Schema Watch] Event EVT-{time.strftime('%M%S')} queued successfully.")
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Schema Watch] Invoking Agent consensus loop.")
            st.session_state.pipeline_status = "ORCHESTRATING_AGENTS"
            st.rerun()

    elif st.session_state.pipeline_status == "ORCHESTRATING_AGENTS":
        with st.spinner("Orchestrating agent consensus logic..."):
            time.sleep(1.2)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Detection Agent] UC Native classification scanned target table. SSN-patterns flagged (Confidence: 94%).")
            time.sleep(1.0)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Ontology Lookup] Querying Genie Glossary API... Found mapping concept: 'National Social Security Identifier'.")
            time.sleep(1.0)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Similarity Worker] Scanning catalog embeddings... Matches found on clinical.PATIENTS.tax_identifier (Similarity: 95%).")
            time.sleep(1.0)
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Supervisor] Evaluated worker agent confidence weights. Composite score: 0.98.")
            st.session_state.pipeline_logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] [Supervisor] Action: Auto-Approve threshold met. Applying tags to catalog schema. Table pending reviews synced.")
            st.session_state.pipeline_status = "COMPLETED"
            st.rerun()

    # Log text area representation
    log_content = "\n".join(st.session_state.pipeline_logs)
    st.text_area("Execution Console Output", log_content, height=280, key="orchestrator_log_view", disabled=True)
    
    if st.session_state.pipeline_status != "IDLE":
        if st.button("Clear Log Screen"):
            st.session_state.pipeline_status = "IDLE"
            st.session_state.pipeline_logs = ["[INFO] Log screen cleared. System ready."]
            st.rerun()
            
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown("<div style='margin-top: 16px;'></div>", unsafe_allow_html=True)

# Event triggers history table
st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
st.markdown("<div class='section-title'>Schema Ingestion Event Trigger History</div>", unsafe_allow_html=True)

df_events = pd.DataFrame(st.session_state.event_triggers)
st.dataframe(
    df_events,
    column_config={
        "Event ID": st.column_config.TextColumn("Event ID"),
        "Event Type": st.column_config.TextColumn("Event Type"),
        "Target Table": st.column_config.TextColumn("Target Table"),
        "Details": st.column_config.TextColumn("Event Details"),
        "Action Taken": st.column_config.TextColumn("Action Taken"),
        "Status": st.column_config.TextColumn("Status"),
        "Timestamp": st.column_config.TextColumn("Triggered Time")
    },
    use_container_width=True,
    hide_index=True
)
st.markdown("</div>", unsafe_allow_html=True)
