import streamlit as st
import pandas as pd
import time
from services.governance_service import GovernanceService
from services.unity_catalog_service import UnityCatalogService
from services.audit_service import AuditService
from utils.permissions import check_permission_page, has_permission
from utils.auth import get_current_user
from utils.helpers import render_top_header, get_status_badge, format_confidence, render_confidence_ring, get_category_color, get_category_badge

check_permission_page("view_queue")
render_top_header()

gov_service   = GovernanceService()
uc_service    = UnityCatalogService()
audit_service = AuditService()
current_user  = get_current_user()

st.markdown(
    "<h2 style='font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;'>"
    "AI-Assisted Governance Workbench</h2>"
    "<p style='font-size:13px;color:var(--ink-muted);margin-bottom:0;'>"
    "Inspect, verify, and classify sensitive columns using ontology matching and catalog similarity analytics."
    "</p>",
    unsafe_allow_html=True
)

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:16px 0;'>", unsafe_allow_html=True)

items = gov_service.get_pending_classifications()

if not items:
    st.info("The review queue is currently empty. No pending classification items.")
    st.stop()

data = []
for item in items:
    data.append({
        "ID":            item.id,
        "Schema":        item.schema_name,
        "Table":         item.table_name,
        "Column":        item.column_name,
        "Suggested Tag": item.suggested_tag,
        "Confidence":    item.confidence_score,
        "Priority":      item.priority,
        "Category":      item.category,
        "Domain":        item.domain,
        "Status":        item.status,
        "Submitted":     item.submitted_time.strftime("%Y-%m-%d %H:%M")
    })
df = pd.DataFrame(data)

# ── Active Filter Counting ───────────────────────────────────────────────────
# Initialize query params default empty lists or values
if "schema_filter" not in st.session_state: st.session_state.schema_filter = []
if "priority_filter" not in st.session_state: st.session_state.priority_filter = []
if "domain_filter" not in st.session_state: st.session_state.domain_filter = []
if "category_filter" not in st.session_state: st.session_state.category_filter = []
if "status_filter" not in st.session_state: st.session_state.status_filter = ["PENDING"]
if "conf_filter" not in st.session_state: st.session_state.conf_filter = 0.0
if "search_col" not in st.session_state: st.session_state.search_col = ""
if "reviewer_filter" not in st.session_state: st.session_state.reviewer_filter = ""

active_filters = 0
if st.session_state.schema_filter: active_filters += 1
if st.session_state.priority_filter: active_filters += 1
if st.session_state.domain_filter: active_filters += 1
if st.session_state.category_filter: active_filters += 1
if st.session_state.status_filter != ["PENDING"]: active_filters += 1
if st.session_state.conf_filter > 0.0: active_filters += 1
if st.session_state.search_col: active_filters += 1
if st.session_state.reviewer_filter: active_filters += 1

# ── Collapsible Filter Panel ─────────────────────────────────────────────────
filter_title = f"Filter Queue ({active_filters} active)" if active_filters else "Filter Queue"
with st.expander(filter_title, expanded=False):
    f_cols = st.columns(4)
    
    with f_cols[0]:
        st.session_state.schema_filter = st.multiselect("Schema", options=sorted(df["Schema"].unique()), default=st.session_state.schema_filter)
        st.session_state.priority_filter = st.multiselect("Priority", options=sorted(df["Priority"].unique()), default=st.session_state.priority_filter)
    with f_cols[1]:
        st.session_state.domain_filter = st.multiselect("Business Domain", options=sorted(df["Domain"].unique()), default=st.session_state.domain_filter)
        st.session_state.category_filter = st.multiselect("Sensitivity", options=sorted(df["Category"].unique()), default=st.session_state.category_filter)
    with f_cols[2]:
        st.session_state.status_filter = st.multiselect("Status", options=sorted(df["Status"].unique()), default=st.session_state.status_filter)
        st.session_state.conf_filter = st.slider("Min Confidence", 0.0, 1.0, float(st.session_state.conf_filter), 0.05)
    with f_cols[3]:
        st.session_state.search_col = st.text_input("Column Search", value=st.session_state.search_col, placeholder="e.g. ssn, phone")
        st.session_state.reviewer_filter = st.text_input("Reviewer Email", value=st.session_state.reviewer_filter, placeholder="steward@enterprise.com")

filtered_df = df.copy()
if st.session_state.schema_filter:   filtered_df = filtered_df[filtered_df["Schema"].isin(st.session_state.schema_filter)]
if st.session_state.priority_filter: filtered_df = filtered_df[filtered_df["Priority"].isin(st.session_state.priority_filter)]
if st.session_state.domain_filter:   filtered_df = filtered_df[filtered_df["Domain"].isin(st.session_state.domain_filter)]
if st.session_state.category_filter: filtered_df = filtered_df[filtered_df["Category"].isin(st.session_state.category_filter)]
if st.session_state.status_filter:   filtered_df = filtered_df[filtered_df["Status"].isin(st.session_state.status_filter)]
if st.session_state.search_col:      filtered_df = filtered_df[filtered_df["Column"].str.contains(st.session_state.search_col, case=False)]
filtered_df = filtered_df[filtered_df["Confidence"] >= st.session_state.conf_filter]

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:12px 0;'>", unsafe_allow_html=True)

# ── Bulk Actions ──────────────────────────────────────────────────────────────
st.markdown("<div class='section-title'>Review Queue</div>", unsafe_allow_html=True)

bulk_col1, bulk_col2, _ = st.columns([2.5, 2.5, 7])
selected_bulk_ids = []

# Queue header row
hdr = st.columns([1, 4, 3, 2, 2])
hdr[0].markdown("<div style='font-size:12px;font-weight:600;color:var(--ink-muted);'>Select</div>", unsafe_allow_html=True)
hdr[1].markdown("<div style='font-size:12px;font-weight:600;color:var(--ink-muted);'>Asset Path</div>", unsafe_allow_html=True)
hdr[2].markdown("<div style='font-size:12px;font-weight:600;color:var(--ink-muted);'>Classification Suggestion</div>", unsafe_allow_html=True)
hdr[3].markdown("<div style='font-size:12px;font-weight:600;color:var(--ink-muted);'>Priority &amp; Confidence</div>", unsafe_allow_html=True)
hdr[4].markdown("<div style='font-size:12px;font-weight:600;color:var(--ink-muted);'>Action</div>", unsafe_allow_html=True)
st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:4px 0;'>", unsafe_allow_html=True)

if filtered_df.empty:
    st.info("No items match your filters. Try widening the confidence range.")
else:
    for idx, row in filtered_df.iterrows():
        c_sel, c_path, c_tag, c_metrics, c_act = st.columns([1, 4, 3, 2, 2])

        is_checked = c_sel.checkbox("Select", key=f"bulk_chk_{row['ID']}", label_visibility="hidden")
        if is_checked:
            selected_bulk_ids.append(row["ID"])

        # Category indicator border bar on left side of Column Name
        c_path.markdown(
            f"<div style='border-left: 3px solid {get_category_color(row['Category'])}; padding-left: 10px; min-height: 24px; display: flex; align-items: center;'>"
            f"<span class='mono-text' style='font-weight:600;'>{row['Schema']}.{row['Table']}.{row['Column']}</span>"
            f"</div>",
            unsafe_allow_html=True
        )
        
        c_tag.markdown(
            f"<div style='display: flex; align-items: center; gap: 8px;'>"
            f"<code style='background:var(--surface-sunken); padding:2px 6px; border-radius:3px; font-size:11px;' class='mono-text'>{row['Suggested Tag']}</code>"
            f"{get_category_badge(row['Category'])}"
            f"</div>",
            unsafe_allow_html=True
        )

        pcolor_map = {"Critical": "var(--danger)", "High": "var(--warning)", "Medium": "var(--primary)", "Low": "var(--ink-muted)"}
        p_color = pcolor_map.get(row["Priority"], "var(--ink-muted)")
        conf_ring_svg = render_confidence_ring(row["Confidence"], size=20)
        c_metrics.markdown(
            f"<div style='display: flex; align-items: center; gap: 8px;'>"
            f"{conf_ring_svg}"
            f"<span style='color:{p_color}; font-weight:600; font-size:13px;'>{row['Priority']}</span>"
            f"<span class='mono-text' style='color:var(--ink-muted); font-size:11px;'>({row['Confidence']*100:.0f}%)</span>"
            f"</div>",
            unsafe_allow_html=True
        )

        if c_act.button("Open Console", key=f"open_{row['ID']}", use_container_width=True):
            st.session_state.active_review_id = row["ID"]
            st.session_state.show_approval_flow = False
            st.rerun()

# Bulk action triggers
can_bulk = has_permission("approve_reject")
with bulk_col1:
    if st.button("Bulk Approve Selected", use_container_width=True, disabled=not selected_bulk_ids or not can_bulk):
        for bid in selected_bulk_ids:
            item = gov_service.get_classification_by_id(bid)
            if item:
                uc_service.apply_column_tag(item.schema_name, item.table_name, item.column_name, item.suggested_tag, current_user["email"])
                gov_service.update_status(item.id, "APPROVED", item.suggested_tag)
                audit_service.log_decision(
                    user_email=current_user["email"], schema=item.schema_name,
                    table=item.table_name, column=item.column_name,
                    previous_tag="None", new_tag=item.suggested_tag,
                    decision="APPROVE", comments="Bulk approved via Workbench",
                    ai_recommendation=item.suggested_tag, confidence_score=item.confidence_score,
                    approval_method="Bulk Approval"
                )
        st.success(f"{len(selected_bulk_ids)} items approved.")
        st.rerun()

with bulk_col2:
    if st.button("Bulk Reject Selected", use_container_width=True, disabled=not selected_bulk_ids or not can_bulk):
        for bid in selected_bulk_ids:
            item = gov_service.get_classification_by_id(bid)
            if item:
                gov_service.update_status(item.id, "REJECTED")
                audit_service.log_decision(
                    user_email=current_user["email"], schema=item.schema_name,
                    table=item.table_name, column=item.column_name,
                    previous_tag="None", new_tag="None",
                    decision="REJECT", comments="Bulk rejected via Workbench",
                    ai_recommendation=item.suggested_tag, confidence_score=item.confidence_score,
                    approval_method="Bulk Approval"
                )
        st.warning(f"{len(selected_bulk_ids)} items rejected.")
        st.rerun()

st.markdown("<hr style='border:0;border-top:1px solid var(--border);margin:16px 0;'>", unsafe_allow_html=True)

# ── Investigation Console ─────────────────────────────────────────────────────
active_id = st.session_state.get("active_review_id")

if active_id:
    active_item = gov_service.get_classification_by_id(active_id)
    if active_item:
        st.markdown(
            f"<div style='font-size:14px;font-weight:600;color:var(--primary);margin-bottom:12px;'>"
            f"Investigation Console &nbsp;&mdash;&nbsp; "
            f"<code class='mono-text' style='background:var(--surface-sunken);padding:4px 8px;border-radius:4px;'>"
            f"{active_item.schema_name}.{active_item.table_name}.{active_item.column_name}"
            f"</code></div>",
            unsafe_allow_html=True
        )

        p_left, p_center, p_right = st.columns([3, 5, 4])

        # ── Panel 1: Asset Details ────────────────────────────────────────────
        with p_left:
            st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
            st.markdown("<div class='section-title'>Asset Details</div>", unsafe_allow_html=True)

            details = {
                "Schema":       active_item.schema_name,
                "Table":        active_item.table_name,
                "Column":       active_item.column_name,
                "Data Type":    active_item.data_type,
                "Domain":       active_item.domain,
                "Category":     active_item.category,
            }
            for k, v in details.items():
                st.markdown(
                    f"<div style='display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;'>"
                    f"<span style='color:var(--ink-muted);'>{k}</span>"
                    f"<span style='color:var(--ink);font-weight:500;' class='mono-val'>{v}</span>"
                    f"</div>",
                    unsafe_allow_html=True
                )

            st.markdown("<div style='margin-top:14px;'></div>", unsafe_allow_html=True)
            st.markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;'>Masked Sample Values</div>", unsafe_allow_html=True)
            if active_item.sample_values:
                for val in active_item.sample_values:
                    st.code(val, language="text")
            else:
                st.caption("No sample values available.")

            st.markdown("<div style='margin-top:12px;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;'>Policies Applied on Approval</div>", unsafe_allow_html=True)
            st.markdown(
                "<div style='font-size:12px;color:var(--ink);'>"
                "Masking: <code class='mono-text'>MASK_SENSITIVE_VALUE</code><br>"
                "ABAC Rule: <code class='mono-text'>StewardOrComplianceRoleRequired</code>"
                "</div>",
                unsafe_allow_html=True
            )
            st.markdown("</div>", unsafe_allow_html=True)

        # ── Panel 2: AI Reasoning & Timeline ─────────────────────────────────
        with p_center:
            st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
            st.markdown("<div class='section-title'>Steward Review Assistant</div>", unsafe_allow_html=True)

            tab_ai, tab_history = st.tabs(["AI Reasoning", "Governance Timeline"])

            with tab_ai:
                col_reason_info, col_reason_ring = st.columns([8, 4])
                
                with col_reason_info:
                    st.markdown(
                        f"<div style='margin-bottom:12px;'>"
                        f"<div style='font-size:11px;color:var(--ink-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;'>Suggested Tag</div>"
                        f"<code class='mono-text' style='font-size:14px;background:var(--surface-sunken);padding:4px 8px;border-radius:4px;'>{active_item.suggested_tag}</code>"
                        f"</div>"
                        f"<div style='margin-bottom:12px;'>"
                        f"<div style='font-size:11px;color:var(--ink-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px;'>Ontology Match</div>"
                        f"<div style='font-size:14px;font-weight:600;color:var(--ink);'>{active_item.concept_match or 'None'}</div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                with col_reason_ring:
                    st.markdown(
                        f"<div style='text-align: center;'>"
                        f"{render_confidence_ring(active_item.confidence_score, size=64)}"
                        f"<div style='font-size: 11px; color: var(--ink-muted); font-weight: 600; margin-top: 4px;'>AI Confidence</div>"
                        f"<div class='mono-text' style='font-size: 14px; font-weight: 700; color: var(--ink);'>{active_item.confidence_score*100:.1f}%</div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )

                st.markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;'>Similar Columns in Catalog</div>", unsafe_allow_html=True)
                if active_item.similar_columns_metrics:
                    for sim in active_item.similar_columns_metrics:
                        sim_val = float(sim['similarity']) / 100.0
                        sim_ring = render_confidence_ring(sim_val, size=20)
                        
                        col_sim_btn, col_sim_info = st.columns([10, 2])
                        with col_sim_info:
                            st.markdown(f"<div style='display:flex;align-items:center;justify-content:flex-end;height:34px;'>{sim_ring}</div>", unsafe_allow_html=True)
                        with col_sim_btn:
                            if st.button(f"{sim['name']} ({sim['similarity']}%)", key=f"sim_{sim['name']}", use_container_width=True):
                                found = [i for i in items if f"{i.schema_name}.{i.table_name}.{i.column_name}" == sim["name"]]
                                if found:
                                    st.session_state.active_review_id = found[0].id
                                    st.session_state.show_approval_flow = False
                                    st.rerun()
                                else:
                                    st.info("This column has already been reviewed.")
                else:
                    st.caption("No similar columns identified.")

                st.markdown("<div style='margin-top:12px;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;'>AI Decision Flow</div>", unsafe_allow_html=True)
                steps = [
                    ("Sensitive Pattern Detected",   "Native classification scan identifies risk signal."),
                    ("Ontology Match Resolved",       f"Matched concept: {active_item.concept_match}."),
                    ("Similar Columns Located",       "Catalog history cross-referenced."),
                    ("Confidence Score Calculated",   f"Score: {format_confidence(active_item.confidence_score)}."),
                    ("Recommendation Generated",      f"Action: {active_item.supervisor_recommendation}."),
                ]
                for step_title, step_desc in steps:
                    st.markdown(
                        f"<div class='timeline-item'>"
                        f"<div style='font-size:13px;font-weight:600;color:var(--ink);'>{step_title}</div>"
                        f"<div style='font-size:12px;color:var(--ink-muted);'>{step_desc}</div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )

            with tab_history:
                st.markdown("<div style='font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;'>Governance Lifecycle</div>", unsafe_allow_html=True)
                for stage in active_item.governance_timeline:
                    st.markdown(
                        f"<div style='padding:10px 12px;border-left:2px solid var(--success);"
                        f"margin-left:6px;margin-bottom:6px;background:var(--bg);border-radius:0 4px 4px 0;'>"
                        f"<div style='font-size:13px;font-weight:600;color:var(--ink);'>{stage['stage']}</div>"
                        f"<div class='mono-text' style='font-size:11px;color:var(--ink-muted);margin-top:2px;'>{stage['timestamp']}</div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )

            st.markdown("</div>", unsafe_allow_html=True)

        # ── Panel 3: Decision Panel ───────────────────────────────────────────
        with p_right:
            st.markdown("<div class='panel-box'>", unsafe_allow_html=True)
            st.markdown("<div class='section-title'>Decision Panel</div>", unsafe_allow_html=True)

            can_act = has_permission("approve_reject")
            if not can_act:
                st.warning("Only Governance Stewards and Compliance Officers can submit decisions.")

            steward_tag      = st.text_input("Classification Tag",    value=active_item.suggested_tag, disabled=not can_act)
            steward_comments = st.text_area("Steward Notes",          value="", placeholder="Provide reasoning for this decision...", disabled=not can_act)

            decision_action = st.selectbox(
                "Decision Action",
                options=[
                    "Approve Recommendation",
                    "Reject Recommendation",
                    "Modify Classification",
                    "Merge with Existing Concept",
                    "Escalate for Expert Review",
                    "Request Additional Information",
                    "Save as Draft"
                ],
                disabled=not can_act
            )

            confirmed = st.checkbox("I confirm this decision conforms to organizational data policies.", disabled=not can_act)

            if st.button("Submit Decision", type="primary", disabled=not confirmed or not can_act, use_container_width=True):
                st.session_state.show_approval_flow = True
                st.session_state.flow_step = 0
                st.rerun()

            if st.session_state.get("show_approval_flow"):
                st.markdown("<div style='margin-top:12px;font-size:11px;font-weight:600;color:var(--ink-muted);letter-spacing:0.06em;text-transform:uppercase;'>Workflow Progress</div>", unsafe_allow_html=True)
                steps = [
                    "Decision Registered",
                    "Unity Catalog Tag Applied",
                    "ABAC Policy Validated",
                    "Governed View Updated",
                    "Audit Record Created",
                    "Notification Broadcast"
                ]
                progress_bar      = st.progress(0.0)
                step_placeholder  = st.empty()

                for i, step_name in enumerate(steps):
                    progress_bar.progress((i + 1) / len(steps))
                    step_placeholder.markdown(
                        f"<div style='font-size:13px;color:var(--success);font-weight:500;'>Step {i+1} of {len(steps)}: {step_name}</div>",
                        unsafe_allow_html=True
                    )
                    time.sleep(0.35)

                # Backend updates
                if "Approve" in decision_action:
                    uc_service.apply_column_tag(active_item.schema_name, active_item.table_name, active_item.column_name, steward_tag, current_user["email"])
                    gov_service.update_status(active_item.id, "APPROVED", steward_tag)
                    audit_service.log_decision(
                        user_email=current_user["email"], schema=active_item.schema_name,
                        table=active_item.table_name, column=active_item.column_name,
                        previous_tag="None", new_tag=steward_tag, decision="APPROVE",
                        comments=steward_comments, ai_recommendation=active_item.suggested_tag,
                        confidence_score=active_item.confidence_score
                    )
                elif "Reject" in decision_action:
                    gov_service.update_status(active_item.id, "REJECTED")
                    audit_service.log_decision(
                        user_email=current_user["email"], schema=active_item.schema_name,
                        table=active_item.table_name, column=active_item.column_name,
                        previous_tag="None", new_tag="None", decision="REJECT",
                        comments=steward_comments, ai_recommendation=active_item.suggested_tag,
                        confidence_score=active_item.confidence_score
                    )
                elif "Modify" in decision_action or "Merge" in decision_action:
                    gov_service.update_status(active_item.id, "APPROVED", steward_tag)
                    audit_service.log_decision(
                        user_email=current_user["email"], schema=active_item.schema_name,
                        table=active_item.table_name, column=active_item.column_name,
                        previous_tag="None", new_tag=steward_tag, decision="MODIFY",
                        comments=steward_comments, ai_recommendation=active_item.suggested_tag,
                        confidence_score=active_item.confidence_score
                    )
                elif "Escalate" in decision_action:
                    gov_service.update_status(active_item.id, "ESCALATED")
                    audit_service.log_decision(
                        user_email=current_user["email"], schema=active_item.schema_name,
                        table=active_item.table_name, column=active_item.column_name,
                        previous_tag="None", new_tag="None", decision="ESCALATE",
                        comments=steward_comments, ai_recommendation=active_item.suggested_tag,
                        confidence_score=active_item.confidence_score
                    )

                st.success("Decision committed. Metadata stores updated.")
                st.session_state.active_review_id  = None
                st.session_state.show_approval_flow = False
                time.sleep(0.8)
                st.rerun()

            st.markdown("</div>", unsafe_allow_html=True)
