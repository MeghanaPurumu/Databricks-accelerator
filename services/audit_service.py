import os
import streamlit as st
import random
import json
import logging
from datetime import datetime, timedelta
from typing import List
from models.audit import AuditEntry
from utils.db import get_spark

logger = logging.getLogger("audit_service")

INITIAL_AUDIT_LOGS = [
    {
        "id": "aud-001",
        "governance_decision_id": "GD-10492",
        "timestamp": datetime.now() - timedelta(days=5),
        "user_email": "steward@enterprise.com",
        "schema_name": "clinical",
        "table_name": "PATIENTS",
        "column_name": "tax_identifier",
        "previous_tag": "None",
        "new_tag": "pii:ssn",
        "decision": "APPROVE",
        "comments": "Matches format criteria perfectly and verified via patient lookup service.",
        "ai_recommendation": "pii:ssn",
        "confidence_score": 0.98,
        "approval_duration": "42s",
        "approval_method": "Manual Steward Review",
        "approval_source": "Steward Portal Workspace UI"
    },
    {
        "id": "aud-002",
        "governance_decision_id": "GD-10493",
        "timestamp": datetime.now() - timedelta(days=3),
        "user_email": "compliance@enterprise.com",
        "schema_name": "clinical",
        "table_name": "ENCOUNTERS",
        "column_name": "primary_diagnosis",
        "previous_tag": "None",
        "new_tag": "phi:icd10",
        "decision": "APPROVE",
        "comments": "Confirmed standard billing ICD10 formats.",
        "ai_recommendation": "phi:icd10",
        "confidence_score": 0.91,
        "approval_duration": "18s",
        "approval_method": "Manual Steward Review",
        "approval_source": "Steward Portal Workspace UI"
    },
    {
        "id": "aud-003",
        "governance_decision_id": "GD-10494",
        "timestamp": datetime.now() - timedelta(days=2),
        "user_email": "steward@enterprise.com",
        "schema_name": "hr_db",
        "table_name": "salaries",
        "column_name": "base_rate",
        "previous_tag": "None",
        "new_tag": "financial:salary",
        "decision": "MODIFY",
        "comments": "Changed suggestion from generic 'financial:numeric' to specific 'financial:salary'.",
        "ai_recommendation": "financial:numeric",
        "confidence_score": 0.85,
        "approval_duration": "1m 12s",
        "approval_method": "Manual Steward Review",
        "approval_source": "Steward Portal Workspace UI"
    }
]

class AuditService:
    def __init__(self):
        self.spark = get_spark()
        catalog = os.environ.get("DATABRICKS_CATALOG", "dev")
        schema = os.environ.get("DATABRICKS_SCHEMA", "brz")
        self.table_name = f"{catalog}.{schema}.governance_audit"
        self.using_live_db = False
        
        # Seed local session state unconditionally as a fallback
        if "audit_logs" not in st.session_state:
            st.session_state.audit_logs = [AuditEntry(**item) for item in INITIAL_AUDIT_LOGS]
        
        if self.spark:
            try:
                # Check if Delta table already exists in catalog
                self.spark.sql(f"DESCRIBE TABLE {self.table_name}")
                logger.info(f"Connected to live Delta table: {self.table_name}")
                self.using_live_db = True
            except Exception:
                # Table does not exist; attempt to bootstrap it
                try:
                    logger.info(f"Bootstrapping live Delta table: {self.table_name}")
                    bootstrap_data = []
                    for log in INITIAL_AUDIT_LOGS:
                        copy_log = log.copy()
                        copy_log["timestamp"] = copy_log["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
                        bootstrap_data.append(copy_log)
                    df = self.spark.createDataFrame(bootstrap_data)
                    df.write.format("delta").mode("overwrite").saveAsTable(self.table_name)
                    logger.info(f"Delta table '{self.table_name}' bootstrapped successfully.")
                    self.using_live_db = True
                except Exception as e:
                    logger.warning(f"Failed to bootstrap audit Delta table: {e}. Will use session state fallback.")

    def _row_to_entry(self, row) -> AuditEntry:
        """Parses a Spark Row object back into a structured AuditEntry Pydantic model."""
        r_dict = row.asDict()
        # Parse timestamp string to datetime
        if isinstance(r_dict.get("timestamp"), str):
            try:
                r_dict["timestamp"] = datetime.strptime(r_dict["timestamp"][:19], "%Y-%m-%d %H:%M:%S")
            except Exception:
                r_dict["timestamp"] = datetime.now()
        elif not r_dict.get("timestamp"):
            r_dict["timestamp"] = datetime.now()
        return AuditEntry(**r_dict)

    def get_audit_history(self) -> List[AuditEntry]:
        """Fetch all audit records. Tries live database first, falls back to session state."""
        if self.spark and self.using_live_db:
            try:
                df = self.spark.sql(f"SELECT * FROM {self.table_name} ORDER BY timestamp DESC")
                rows = df.collect()
                return [self._row_to_entry(row) for row in rows]
            except Exception as e:
                logger.warning(f"Error querying live Delta table: {e}. Falling back to session state.")
        return st.session_state.audit_logs

    def log_decision(
        self, 
        user_email: str, 
        schema: str, 
        table: str, 
        column: str, 
        previous_tag: str, 
        new_tag: str, 
        decision: str, 
        comments: str,
        ai_recommendation: str,
        confidence_score: float,
        approval_duration: str = "30s",
        approval_method: str = "Manual Steward Review",
        approval_source: str = "Steward Portal Workspace UI"
    ) -> AuditEntry:
        """Create and save a new audit log entry."""
        audit_id = f"aud-{random.randint(100, 999)}"
        decision_id = f"GD-{random.randint(10000, 99999)}"
        timestamp_now = datetime.now()
        
        entry = AuditEntry(
            id=audit_id,
            governance_decision_id=decision_id,
            timestamp=timestamp_now,
            user_email=user_email,
            schema_name=schema,
            table_name=table,
            column_name=column,
            previous_tag=previous_tag,
            new_tag=new_tag,
            decision=decision,
            comments=comments,
            ai_recommendation=ai_recommendation,
            confidence_score=confidence_score,
            approval_duration=approval_duration,
            approval_method=approval_method,
            approval_source=approval_source
        )
        
        # Always prepend to local session state first
        st.session_state.audit_logs.insert(0, entry)
        
        if self.spark and self.using_live_db:
            try:
                escaped_comments = comments.replace("'", "\\'")
                escaped_prev_tag = previous_tag.replace("'", "\\'")
                escaped_new_tag = new_tag.replace("'", "\\'")
                escaped_ai_rec = ai_recommendation.replace("'", "\\'")
                
                query = f"""
                    INSERT INTO {self.table_name} VALUES (
                        '{audit_id}',
                        '{decision_id}',
                        '{timestamp_now.strftime("%Y-%m-%d %H:%M:%S")}',
                        '{user_email}',
                        '{schema}',
                        '{table}',
                        '{column}',
                        '{escaped_prev_tag}',
                        '{escaped_new_tag}',
                        '{decision}',
                        '{escaped_comments}',
                        '{escaped_ai_rec}',
                        {confidence_score},
                        '{approval_duration}',
                        '{approval_method}',
                        '{approval_source}'
                    )
                """
                self.spark.sql(query)
                logger.info(f"Successfully saved decision to live Delta table: {self.table_name}")
            except Exception as e:
                logger.error(f"Error logging decision to Delta: {e}")
            
        return entry

