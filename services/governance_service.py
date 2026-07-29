import streamlit as st
import json
from datetime import datetime, timedelta
from typing import List, Optional
from models.classification import ClassificationItem
from utils.db import get_spark, is_databricks

# Seeding pending classifications directly from the Healthcare Enterprise Data Model
INITIAL_PENDING_REVIEWS = [
    {
        "id": "req-101",
        "schema_name": "clinical",
        "table_name": "PATIENTS",
        "column_name": "ssn",
        "data_type": "STRING",
        "suggested_tag": "pii:ssn",
        "native_classification": "PII - Social Security Number",
        "ontology_match": "National Identification Number",
        "similar_columns": ["clinical.PATIENTS.tax_identifier (pii:ssn)"],
        "confidence_score": 0.98,
        "supervisor_recommendation": "Auto-Approve",
        "ai_explanation": "SSN keyword and length pattern matching verified against master patient directory.",
        "sample_values": ["***-**-1234", "***-**-5678", "***-**-9012"],
        "status": "PENDING",
        "submitted_time": datetime.now() - timedelta(hours=2),
        "priority": "Critical",
        "category": "PII",
        "domain": "Clinical",
        "concept_match": "National Social Security Identifier",
        "concept_confidence": 0.99,
        "similar_columns_metrics": [
            {"name": "clinical.PATIENTS.tax_identifier", "similarity": 95.0}
        ],
        "governance_timeline": [
            {"stage": "Column Created", "timestamp": (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d %H:%M")},
            {"stage": "AI Classified", "timestamp": (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M")}
        ]
    },
    {
        "id": "req-102",
        "schema_name": "clinical",
        "table_name": "DIAGNOSES",
        "column_name": "icd_code",
        "data_type": "STRING",
        "suggested_tag": "phi:diagnosis",
        "native_classification": "Sensitive - ICD Diagnosis Code",
        "ontology_match": "Clinical Diagnosis Disease Reference",
        "similar_columns": ["clinical.ENCOUNTERS.primary_diagnosis (phi:diagnosis)"],
        "confidence_score": 0.89,
        "supervisor_recommendation": "Review Required",
        "ai_explanation": "Identified standard alphanumeric ICD-10 medical diagnostics values.",
        "sample_values": ["I10", "E11.9", "J45.909"],
        "status": "PENDING",
        "submitted_time": datetime.now() - timedelta(hours=4),
        "priority": "High",
        "category": "PHI",
        "domain": "Clinical",
        "concept_match": "ICD Medical Coding Taxonomy",
        "concept_confidence": 0.92,
        "similar_columns_metrics": [
            {"name": "clinical.ENCOUNTERS.primary_diagnosis", "similarity": 88.0}
        ],
        "governance_timeline": [
            {"stage": "Column Created", "timestamp": (datetime.now() - timedelta(days=8)).strftime("%Y-%m-%d %H:%M")},
            {"stage": "AI Classified", "timestamp": (datetime.now() - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M")}
        ]
    },
    {
        "id": "req-103",
        "schema_name": "revenue_cycle",
        "table_name": "CLAIMS",
        "column_name": "claim_amount",
        "data_type": "DECIMAL",
        "suggested_tag": "financial:amount",
        "native_classification": "PCI/Financial - Billing Charge",
        "ontology_match": "Monetary Dollar Value",
        "similar_columns": ["revenue_cycle.CLAIM_LINE_ITEMS.charge_amount (financial:amount)"],
        "confidence_score": 0.95,
        "supervisor_recommendation": "Auto-Approve",
        "ai_explanation": "Double-precision dollar scale and header context maps to financial billing guidelines.",
        "sample_values": ["1250.00", "450.50", "8900.00"],
        "status": "PENDING",
        "submitted_time": datetime.now() - timedelta(hours=6),
        "priority": "Medium",
        "category": "Financial",
        "domain": "Revenue Cycle",
        "concept_match": "Adjudicated Charge Valuation",
        "concept_confidence": 0.97,
        "similar_columns_metrics": [
            {"name": "revenue_cycle.CLAIM_LINE_ITEMS.charge_amount", "similarity": 98.0}
        ],
        "governance_timeline": [
            {"stage": "Column Created", "timestamp": (datetime.now() - timedelta(days=12)).strftime("%Y-%m-%d %H:%M")},
            {"stage": "AI Classified", "timestamp": (datetime.now() - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M")}
        ]
    },
    {
        "id": "req-104",
        "schema_name": "clinical",
        "table_name": "CLINICAL_NOTES",
        "column_name": "note_text",
        "data_type": "STRING",
        "suggested_tag": "phi:notes",
        "native_classification": "Unstructured Medical Text",
        "ontology_match": "Clinical Encounter Progression Note",
        "similar_columns": [],
        "confidence_score": 0.68,
        "supervisor_recommendation": "Escalate (Low Confidence)",
        "ai_explanation": "Unstructured practitioner note containing high-risk symptoms and patient indicators.",
        "sample_values": [
            "Patient describes a history of coronary artery bypass grafting in 2022.",
            "No active signs of fever or respiratory complications during physician encounter."
        ],
        "status": "PENDING",
        "submitted_time": datetime.now() - timedelta(days=1),
        "priority": "High",
        "category": "PHI",
        "domain": "Clinical",
        "concept_match": "Physician Medical Documentation",
        "concept_confidence": 0.72,
        "similar_columns_metrics": [],
        "governance_timeline": [
            {"stage": "Column Created", "timestamp": (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d %H:%M")},
            {"stage": "AI Classified", "timestamp": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M")}
        ]
    },
    {
        "id": "req-105",
        "schema_name": "organization",
        "table_name": "PROVIDERS",
        "column_name": "work_phone",
        "data_type": "STRING",
        "suggested_tag": "pii:phone",
        "native_classification": "PII - Contact Info",
        "ontology_match": "Telephone Number",
        "similar_columns": ["clinical.PATIENTS.phone_num (pii:phone)"],
        "confidence_score": 0.94,
        "supervisor_recommendation": "Auto-Approve",
        "ai_explanation": "Alphanumeric validation matches global and US standard telephone formats.",
        "sample_values": ["+1-555-9876", "+1-555-1234"],
        "status": "PENDING",
        "submitted_time": datetime.now() - timedelta(days=2),
        "priority": "Low",
        "category": "PII",
        "domain": "Organization",
        "concept_match": "Corporate Communications Line",
        "concept_confidence": 0.96,
        "similar_columns_metrics": [
            {"name": "clinical.PATIENTS.phone_num", "similarity": 91.0}
        ],
        "governance_timeline": [
            {"stage": "Column Created", "timestamp": (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d %H:%M")},
            {"stage": "AI Classified", "timestamp": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d %H:%M")}
        ]
    }
]

class GovernanceService:
    def __init__(self):
        self.spark = get_spark()
        self.table_name = "pending_classifications"
        
        if self.spark:
            try:
                # Force recreation on start to ensure schema/content changes propagate to Delta
                self.spark.sql(f"DROP TABLE IF EXISTS {self.table_name}")
                self._create_table()
            except Exception as e:
                logger.error(f"Error dropping/recreating table: {e}")
                self._create_table()
        else:
            # Fallback to local session_state mock
            if "pending_reviews" not in st.session_state:
                st.session_state.pending_reviews = {
                    item["id"]: ClassificationItem(**item) for item in INITIAL_PENDING_REVIEWS
                }

    def _create_table(self):
        """Creates the Delta table and inserts initial healthcare model classifications."""
        bootstrap_data = []
        for item in INITIAL_PENDING_REVIEWS:
            copy_item = item.copy()
            copy_item["similar_columns"] = json.dumps(copy_item["similar_columns"])
            copy_item["sample_values"] = json.dumps(copy_item["sample_values"])
            copy_item["similar_columns_metrics"] = json.dumps(copy_item["similar_columns_metrics"])
            copy_item["governance_timeline"] = json.dumps(copy_item["governance_timeline"])
            bootstrap_data.append(copy_item)
        
        df = self.spark.createDataFrame(bootstrap_data)
        df.write.format("delta").mode("overwrite").saveAsTable(self.table_name)

    def _row_to_item(self, row) -> ClassificationItem:
        """Parses a Spark Row object back into a structured Pydantic ClassificationItem model."""
        r_dict = row.asDict()
        for k in ["similar_columns", "sample_values", "similar_columns_metrics", "governance_timeline"]:
            if isinstance(r_dict.get(k), str):
                try:
                    r_dict[k] = json.loads(r_dict[k])
                except Exception:
                    r_dict[k] = []
        return ClassificationItem(**r_dict)

    def get_pending_classifications(self) -> List[ClassificationItem]:
        """Fetch all classifications in the queue."""
        if self.spark:
            try:
                df = self.spark.sql(f"SELECT * FROM {self.table_name}")
                rows = df.collect()
                return [self._row_to_item(row) for row in rows]
            except Exception as e:
                st.error(f"Error querying Delta table: {e}")
                return []
        else:
            return list(st.session_state.pending_reviews.values())

    def get_classification_by_id(self, item_id: str) -> Optional[ClassificationItem]:
        """Fetch a specific classification item by unique request ID."""
        if self.spark:
            try:
                df = self.spark.sql(f"SELECT * FROM {self.table_name} WHERE id = '{item_id}'")
                rows = df.collect()
                if rows:
                    return self._row_to_item(rows[0])
                return None
            except Exception as e:
                st.error(f"Error querying classification by ID: {e}")
                return None
        else:
            return st.session_state.pending_reviews.get(item_id)

    def update_status(self, item_id: str, status: str, suggested_tag: Optional[str] = None) -> bool:
        """Update the status of a classification recommendation."""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        if self.spark:
            try:
                item = self.get_classification_by_id(item_id)
                if not item:
                    return False
                
                item.status = status.upper()
                if suggested_tag:
                    item.suggested_tag = suggested_tag
                
                item.governance_timeline.append({
                    "stage": f"Steward Decision: {status.upper()}",
                    "timestamp": now_str
                })
                if status.upper() == "APPROVED":
                    item.governance_timeline.append({"stage": "Policy Applied (ABAC & Masking)", "timestamp": now_str})
                    item.governance_timeline.append({"stage": "Governed View Updated", "timestamp": now_str})
                
                ser_timeline = json.dumps(item.governance_timeline)
                escaped_tag = item.suggested_tag.replace("'", "\\'")
                
                query = f"""
                    UPDATE {self.table_name}
                    SET status = '{status.upper()}',
                        suggested_tag = '{escaped_tag}',
                        governance_timeline = '{ser_timeline}'
                    WHERE id = '{item_id}'
                """
                self.spark.sql(query)
                return True
            except Exception as e:
                st.error(f"Error writing updates to Delta: {e}")
                return False
        else:
            if item_id in st.session_state.pending_reviews:
                item = st.session_state.pending_reviews[item_id]
                item.status = status.upper()
                if suggested_tag:
                    item.suggested_tag = suggested_tag
                
                item.governance_timeline.append({
                    "stage": f"Steward Decision: {status.upper()}",
                    "timestamp": now_str
                })
                if status.upper() == "APPROVED":
                    item.governance_timeline.append({"stage": "Policy Applied (ABAC & Masking)", "timestamp": now_str})
                    item.governance_timeline.append({"stage": "Governed View Updated", "timestamp": now_str})
                    
                st.session_state.pending_reviews[item_id] = item
                return True
            return False
