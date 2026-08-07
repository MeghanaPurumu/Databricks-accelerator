import streamlit as st
import time
import logging
from datetime import datetime

logger = logging.getLogger("qa_service")


class QAService:
    """
    Governance Q&A Service backed by the Databricks Foundation Model API.
    Falls back to rule-based pattern matching when not connected to Databricks.
    """

    # Databricks Foundation Model endpoint name (DBRX or LLaMA 3.1)
    MODEL_ENDPOINT = "databricks-meta-llama-3-1-70b-instruct"
    MODEL_DISPLAY   = "Meta LLaMA 3.1 70B Instruct (Databricks)"

    def __init__(self):
        from utils.db import get_workspace_client, get_spark
        self.client = get_workspace_client()
        self.spark  = get_spark()
        self.last_live_ts: datetime | None = None
        self.last_query_ms: float | None = None

        # Track first live call timestamp in session
        if "qa_last_live_ts" not in st.session_state:
            st.session_state.qa_last_live_ts = None
        if "qa_model_name" not in st.session_state:
            st.session_state.qa_model_name = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def ask(self, question: str) -> str:
        """Route a governance question to the live LLM or rule-based fallback."""
        return self.ask_governance_agent(question)

    def ask_governance_agent(self, question: str) -> str:
        """
        Sends the user's question to the Databricks Foundation Model LLM
        with a rich governance context system prompt.
        Falls back to rule-based answers if LLM is unavailable.
        """
        t_start = time.time()

        if self.client:
            try:
                response = self._call_databricks_llm(question)
                elapsed_ms = (time.time() - t_start) * 1000
                self.last_query_ms = elapsed_ms
                st.session_state.qa_last_query_ms = elapsed_ms
                st.session_state.qa_last_live_ts = datetime.now()
                st.session_state.qa_model_name = self.MODEL_DISPLAY
                return response
            except Exception as e:
                logger.warning(f"LLM call failed, falling back to rule-based: {e}")

        # Rule-based fallback
        elapsed_ms = (time.time() - t_start) * 1000
        self.last_query_ms = elapsed_ms
        st.session_state.qa_last_query_ms = elapsed_ms
        st.session_state.qa_model_name = "Rule-Based Engine (Fallback)"
        return self._rule_based_answer(question)

    # ── Databricks LLM integration ──────────────────────────────────────────────

    def _build_system_prompt(self) -> str:
        """Build a rich system prompt with live governance context."""
        pending_items = list(st.session_state.get("pending_reviews", {}).values())
        audit_logs    = st.session_state.get("audit_logs", [])
        uc_catalog    = st.session_state.get("unity_catalog", {})

        # Summarize pending queue
        pending_by_cat = {}
        for item in pending_items:
            if item.status == "PENDING":
                pending_by_cat[item.category] = pending_by_cat.get(item.category, 0) + 1

        # Summarize classified columns
        classified = sum(1 for v in uc_catalog.values() if v.get("tag"))
        total_cols = len(uc_catalog)

        # Summarize recent audit decisions
        recent_decisions = []
        for entry in audit_logs[:5]:
            ts = str(entry.timestamp)[:16] if hasattr(entry.timestamp, "__str__") else ""
            recent_decisions.append(
                f"- [{ts}] {entry.user_email} {entry.decision} "
                f"{entry.schema_name}.{entry.table_name}.{entry.column_name} "
                f"→ tag: {entry.new_tag} (confidence: {entry.confidence_score*100:.0f}%)"
            )

        # Detect live connection info
        live_ts = st.session_state.get("qa_last_live_ts")
        live_str = live_ts.strftime("%Y-%m-%d %H:%M:%S") if live_ts else "Not yet queried"
        query_ms = st.session_state.get("qa_last_query_ms")
        timing_str = f"{query_ms:.0f}ms" if query_ms else "N/A"

        prompt = f"""You are GovernX, an AI governance assistant for the Databricks Data Intelligence Platform.
You help data stewards, compliance officers, and data engineers understand data classification, 
sensitivity tags, audit trails, and governance policies across Unity Catalog.

## Live System Status
- Current time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- Last live connection: {live_str}
- Last query response time: {timing_str}
- Model: {self.MODEL_DISPLAY}

## Active Governance Catalog
- Unity Catalog: dev.brz schema
- Total columns tracked: {total_cols}
- Classified columns: {classified}
- Unclassified columns: {total_cols - classified}

## Pending Review Queue
{chr(10).join([f"- {cat}: {count} column(s) awaiting review" for cat, count in pending_by_cat.items()]) or "- No pending items"}

## Recent Governance Decisions (last 5)
{chr(10).join(recent_decisions) or "- No recent decisions logged"}

## Instructions
- Answer governance questions concisely and factually based on the live context above.
- If asked about query time / response time, report the last query timing.
- If asked when you were last live, report the "Last live connection" timestamp.
- If asked about table changes, describe recent decisions from the audit trail.
- Format answers in markdown with bullet lists where helpful.
- If a question falls outside governance scope, say so politely.
"""
        return prompt

    def _call_databricks_llm(self, question: str) -> str:
        """Call the Databricks Foundation Model serving endpoint."""
        system_prompt = self._build_system_prompt()

        # Use the serving_endpoints.query API (SDK v0.20+)
        response = self.client.serving_endpoints.query(
            name=self.MODEL_ENDPOINT,
            messages=[
                {"role": "system",  "content": system_prompt},
                {"role": "user",    "content": question}
            ],
            max_tokens=1024,
            temperature=0.2
        )

        # Extract text from response
        if hasattr(response, "choices") and response.choices:
            choice = response.choices[0]
            if hasattr(choice, "message") and choice.message:
                return choice.message.content or ""
            if hasattr(choice, "text"):
                return choice.text or ""

        return "The governance agent returned an empty response. Please try again."

    def get_live_table_changes(self, table_name: str) -> str:
        """
        Query the live audit log or Delta history for recent changes to a table.
        Returns a formatted summary of recent changes.
        """
        if not self.spark:
            return "Live table change tracking requires a Databricks connection."

        try:
            t_start = time.time()
            history_df = self.spark.sql(
                f"DESCRIBE HISTORY dev.brz.{table_name} LIMIT 10"
            )
            rows = history_df.collect()
            elapsed = (time.time() - t_start) * 1000
            lines = [f"**Recent changes to `dev.brz.{table_name}`** (query: {elapsed:.0f}ms):\n"]
            for row in rows:
                r = row.asDict()
                lines.append(
                    f"- [{r.get('timestamp', '')}] "
                    f"Op: `{r.get('operation', 'N/A')}` "
                    f"by `{r.get('userName', 'unknown')}`"
                )
            return "\n".join(lines)
        except Exception as e:
            return f"Could not retrieve table history for `{table_name}`: {e}"

    # ── Rule-based fallback ────────────────────────────────────────────────────

    def _rule_based_answer(self, question: str) -> str:
        """
        Fallback rule-based Q&A when Databricks LLM is unavailable.
        Dynamically pulls stats from session state.
        """
        time.sleep(0.5)
        q = question.lower()

        if "pending_reviews" not in st.session_state:
            return "Unable to access the review catalog."

        pending_items = st.session_state.pending_reviews.values()

        if "phi" in q and "pending" in q:
            phi_pending = [
                f"`{item.schema_name}.{item.table_name}.{item.column_name}` "
                f"(AI Suggested: `{item.suggested_tag}`, Confidence: {item.confidence_score*100:.1f}%)"
                for item in pending_items if "phi" in item.suggested_tag and item.status == "PENDING"
            ]
            if phi_pending:
                return "**Pending PHI Columns for Review:**\n\n" + "\n".join([f"- {col}" for col in phi_pending])
            return "There are no pending PHI columns remaining in the queue."

        elif "pii" in q and ("unclassified" in q or "pending" in q or "clinical" in q):
            pii_cols = [
                f"`{item.schema_name}.{item.table_name}.{item.column_name}` "
                f"(AI Suggested: `{item.suggested_tag}`)"
                for item in pending_items if "pii" in item.suggested_tag and item.status == "PENDING"
            ]
            if pii_cols:
                return "**PII Columns Pending Classification:**\n\n" + "\n".join([f"- {col}" for col in pii_cols])
            return "No unclassified PII columns were found in the active review queues."

        elif "last live" in q or "last connected" in q or "when" in q and "live" in q:
            live_ts = st.session_state.get("qa_last_live_ts")
            if live_ts:
                return (f"**Last Live Connection:** {live_ts.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                        f"The governance agent was last connected to the live Databricks workspace at the above time.")
            return ("**No live connection has been established yet.**\n\n"
                    "The agent is running in fallback/offline mode. Connect to a Databricks workspace "
                    "to enable live governance intelligence.")

        elif "time" in q and ("taken" in q or "response" in q or "query" in q):
            ms = st.session_state.get("qa_last_query_ms")
            if ms:
                return f"**Last Query Response Time:** {ms:.0f}ms\n\nThe governance agent processed the previous query in {ms:.0f} milliseconds."
            return "No query timing data is available yet. Ask a governance question first."

        elif "sla" in q or "approval" in q:
            return ("**Approval SLA Policy:**\n\n"
                    "- **PHI columns**: Must be reviewed within **24 hours** of detection.\n"
                    "- **PII columns**: Must be reviewed within **48 hours** of detection.\n"
                    "- **Financial columns**: Must be reviewed within **72 hours** of detection.\n"
                    "- Escalated items require **Compliance Officer** sign-off within **4 hours**.")

        elif "approved" in q and ("last" in q or "recent" in q or "5" in q or "five" in q):
            audit_logs = st.session_state.get("audit_logs", [])
            approved = [e for e in audit_logs if e.decision == "APPROVE"][:5]
            if approved:
                lines = [f"- [{str(e.timestamp)[:16]}] `{e.schema_name}.{e.table_name}.{e.column_name}` → `{e.new_tag}` by **{e.user_email}**"
                         for e in approved]
                return "**Last 5 Approved Governance Decisions:**\n\n" + "\n".join(lines)
            return "No approved governance decisions found in the audit trail."

        elif "abac" in q or "policy" in q or "access" in q:
            return ("**ABAC Policies Applied to PII/PHI Tags:**\n\n"
                    "- `phi:*` tags → **PhysicianOrCompliance** role required\n"
                    "- `pii:ssn`, `pii:dob` → **ComplianceRoleRequired**\n"
                    "- `financial:*` tags → **FinanceRoleOnly**\n"
                    "- All masking policies enforced at query time via Unity Catalog dynamic views.")

        elif "masking" in q or "clinical" in q:
            return ("**Active Masking Policies on `clinical` schema:**\n\n"
                    "- `clinical.PATIENTS.tax_identifier` → **MASK_FULL_SSN** (replaces SSN format with asterisks)\n"
                    "- `clinical.PATIENTS.phone_num` → **MASK_LAST_4** (masks all but the last 4 digits)")

        elif "financial" in q and ("column" in q or "list" in q or "pending" in q):
            fin_cols = [
                f"`{item.schema_name}.{item.table_name}.{item.column_name}` "
                f"(Tag: `{item.suggested_tag}`, Confidence: {item.confidence_score*100:.0f}%)"
                for item in pending_items if "financial" in item.category.lower() and item.status == "PENDING"
            ]
            if fin_cols:
                return "**Pending Financial Domain Columns:**\n\n" + "\n".join([f"- {col}" for col in fin_cols])
            return "No pending financial domain columns found."

        # Generic summary
        total_pending = len([i for i in pending_items if i.status == "PENDING"])
        return (f"I've scanned your Unity Catalog metadata and governance catalog.\n\n"
                f"Regarding your query **'{question}'**:\n"
                f"- **{total_pending}** columns currently pending review in the queue\n"
                f"- Running in **rule-based fallback mode** (no live Databricks LLM connection)\n\n"
                "You can query: PHI/PII pending columns, masking policies, approval SLAs, "
                "ABAC policies, or recent decisions for precise analytics.")
