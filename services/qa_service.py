import streamlit as st
import time

class QAService:
    def ask(self, question: str) -> str:
        """Alias for ask_governance_agent to support page interface query requests."""
        return self.ask_governance_agent(question)

    def ask_governance_agent(self, question: str) -> str:
        """
        Sends the user's natural language question to the Governance Q&A Agent API.
        We simulate a small latency and compile dynamic, rich answers based on the prompt contents.
        """
        # Simulate network latency
        time.sleep(1.0)
        
        q = question.lower()
        
        # We can dynamically pull current statistics or statuses from st.session_state
        if "pending_reviews" not in st.session_state:
            return "Unable to access the review catalog."
            
        pending_items = st.session_state.pending_reviews.values()
        
        if "phi" in q and "pending" in q:
            phi_pending = [
                f"`{item.schema_name}.{item.table_name}.{item.column_name}` (AI Suggested: `{item.suggested_tag}`, Confidence: {item.confidence_score*100:.1f}%)"
                for item in pending_items if "phi" in item.suggested_tag and item.status == "PENDING"
            ]
            if phi_pending:
                return "**Pending PHI Columns for Review:**\n\n" + "\n".join([f"- {col}" for col in phi_pending])
            else:
                return "There are no pending PHI columns remaining in the queue."
                
        elif "pii" in q and "unclassified" in q:
            pii_unclassified = [
                f"`{item.schema_name}.{item.table_name}.{item.column_name}` (AI Suggested: `{item.suggested_tag}`)"
                for item in pending_items if "pii" in item.suggested_tag and item.status == "PENDING"
            ]
            if pii_unclassified:
                return "**Tables containing unclassified/pending PII columns:**\n\n" + "\n".join([f"- {col}" for col in pii_unclassified])
            else:
                return "No unclassified PII columns were found in the active review queues."
                
        elif "pii:email" in q:
            # Look in our mock UC catalog for approved ones, plus pending
            emails = []
            if "unity_catalog" in st.session_state:
                for col_key, val in st.session_state.unity_catalog.items():
                    if val["tag"] == "pii:email":
                        emails.append(f"`{col_key}` (Status: Active tag)")
            for item in pending_items:
                if item.suggested_tag == "pii:email" and item.status == "PENDING":
                    emails.append(f"`{item.schema_name}.{item.table_name}.{item.column_name}` (Status: Suggested / Review Pending)")
            
            if emails:
                return "**Columns tagged as `pii:email`:**\n\n" + "\n".join([f"- {col}" for col in emails])
            else:
                return "No columns matching the tag `pii:email` were found."
                
        elif "patient_ssn" in q or "tax_identifier" in q:
            return ("According to audit logs, `clinical.PATIENTS.tax_identifier` was approved by "
                    "**steward@enterprise.com** on **2026-07-01** following native classification flags.")
                    
        elif "raw tables" in q or "accessed" in q:
            return ("**Data Access Audit:** The following raw tables were accessed in the last 7 days:\n\n"
                    "1. `clinical.PATIENTS` (Accessed by: `svc_ingestion_pipeline`, Reads: 14M rows)\n"
                    "2. `clinical.ENCOUNTERS` (Accessed by: `steward@enterprise.com`, Reads: 2.3K rows)\n"
                    "3. `revenue_cycle.CLAIMS` (Accessed by: `trial_coordinator_agent`, Reads: 400K rows)")
                    
        elif "masking policies" in q or "clinical" in q:
            return ("**Active Masking Policies on `clinical` schema:**\n\n"
                    "- `clinical.PATIENTS.tax_identifier` -> **MASK_FULL_SSN** (replaces SSN format with asterisks)\n"
                    "- `clinical.PATIENTS.phone_num` -> **MASK_LAST_4** (masks all but the last 4 digits)")
                    
        # General response helper
        return (f"I've scanned your Unity Catalog metadata and the Databricks Governance catalog. "
                f"Regarding your query **'{question}'**: There are currently {len([i for i in pending_items if i.status == 'PENDING'])} items in the pending review queue. "
                "You can query specific attributes such as PHI/PII pending, masking policies, or audit details for precise analytics.")

