import os
import streamlit as st
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from models.classification import ClassificationItem
from utils.db import get_spark, get_workspace_client, is_databricks

logger = logging.getLogger("governance_service")

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

# ── AI Classification rules: column name patterns → (tag, category, confidence, priority) ──
COLUMN_CLASSIFICATION_RULES = [
    (["ssn", "social_security", "tax_id", "tax_identifier", "national_id"], "pii:ssn",         "PII",       0.97, "Critical", "PII - Social Security Number",       "SSN keyword and format pattern matched."),
    (["phone", "mobile", "cell", "telephone", "contact_number"],           "pii:phone",        "PII",       0.92, "Low",      "PII - Contact Phone Number",          "Phone number keyword matched."),
    (["email", "email_address", "mail"],                                    "pii:email",        "PII",       0.94, "Medium",   "PII - Email Address",                 "Email keyword matched."),
    (["first_name", "last_name", "full_name", "patient_name", "name"],     "pii:name",         "PII",       0.89, "High",     "PII - Personal Name",                 "Name keyword matched."),
    (["dob", "date_of_birth", "birth_date", "birthdate"],                  "pii:dob",          "PII",       0.96, "High",     "PII - Date of Birth",                 "Date of birth pattern matched."),
    (["address", "street", "city", "zip", "postal_code", "location"],      "pii:address",      "PII",       0.88, "Medium",   "PII - Physical Address",              "Address/location keyword matched."),
    (["diagnosis", "icd", "icd_code", "icd10", "condition", "disease"],    "phi:diagnosis",    "PHI",       0.93, "Critical", "PHI - Medical Diagnosis Code",        "ICD diagnosis keyword matched."),
    (["medication", "drug", "prescription", "dosage", "rx", "ndc"],        "phi:prescription", "PHI",       0.91, "High",     "PHI - Prescription Information",      "Medication/prescription keyword matched."),
    (["mrn", "patient_id", "member_id", "encounter_id", "visit_id"],       "phi:patient_id",   "PHI",       0.95, "Critical", "PHI - Patient Identifier",            "Patient identifier keyword matched."),
    (["lab", "result", "test_result", "observation", "specimen"],          "phi:lab_result",   "PHI",       0.87, "High",     "PHI - Lab/Clinical Observation",      "Lab result keyword matched."),
    (["claim_amount", "charge", "payment", "amount", "billed", "cost"],    "financial:amount", "Financial", 0.94, "Medium",   "PCI/Financial - Billing Charge",      "Financial billing amount pattern matched."),
    (["account", "bank", "routing", "credit_card", "card_number"],         "financial:account","Financial", 0.96, "High",     "PCI - Financial Account Number",      "Payment/banking keyword matched."),
    (["npi", "provider_id", "physician_id", "dea_number"],                 "phi:provider_id",  "PHI",       0.90, "High",     "PHI - Provider Identifier",           "Provider/physician ID keyword matched."),
    (["insurance", "payer", "plan_id", "group_number", "policy_number"],   "pii:insurance",    "PII",       0.86, "Medium",   "PII - Insurance Identifier",          "Insurance plan keyword matched."),
]

def _classify_column(col_name: str, data_type: str):
    """Rule-based AI classifier: returns (tag, category, confidence, priority, native_class, explanation)."""
    col_lower = col_name.lower()
    for keywords, tag, category, conf, priority, native_class, explanation in COLUMN_CLASSIFICATION_RULES:
        if any(kw in col_lower for kw in keywords):
            return tag, category, conf, priority, native_class, explanation
    # Generic fallback for unrecognized columns
    return None, "Unknown", 0.0, "Low", "Unclassified", "No matching governance pattern found."

class GovernanceService:
    def __init__(self):
        self.spark  = get_spark()
        self.client = get_workspace_client()
        self.live_catalog = os.environ.get("DATABRICKS_CATALOG", "dev")
        self.live_schema  = os.environ.get("DATABRICKS_SCHEMA",  "brz")
        self.audit_table  = f"{self.live_catalog}.{self.live_schema}.governance_audit"

        # Only seed session state once per session
        if "pending_reviews" not in st.session_state:
            items = self._scan_live_catalog() if (self.client or self.spark) else []
            if not items:
                items = [ClassificationItem(**item) for item in INITIAL_PENDING_REVIEWS]
            st.session_state.pending_reviews = {item.id: item for item in items}

    # ── Live catalog scanner ──────────────────────────────────────────────────
    def _scan_live_catalog(self) -> List[ClassificationItem]:
        """
        Enumerates every column in LIVE_CATALOG.LIVE_SCHEMA, generates a
        ClassificationItem for each governance-relevant column.
        Tries Databricks SDK metadata first, then falls back to Spark SQL.
        """
        items = []
        now = datetime.now()

        def _process_columns(table_name: str, column_iter):
            """Build ClassificationItems from an iterable of (col_name, data_type) tuples."""
            for col_name, data_type in column_iter:
                if not col_name or col_name.startswith("#"):
                    continue
                tag, category, conf, priority, native_class, explanation = \
                    _classify_column(col_name, data_type or "STRING")
                if tag is None:
                    continue
                item_id = f"live-{self.live_schema}-{table_name}-{col_name}".lower().replace(" ", "_")
                items.append(ClassificationItem(
                    id=item_id,
                    schema_name=self.live_schema,
                    table_name=table_name,
                    column_name=col_name,
                    data_type=data_type or "STRING",
                    suggested_tag=tag,
                    native_classification=native_class,
                    ontology_match="",
                    similar_columns=[],
                    confidence_score=conf,
                    supervisor_recommendation="Auto-Approve" if conf >= 0.95 else "Review Recommended",
                    ai_explanation=explanation,
                    sample_values=[],
                    status="PENDING",
                    submitted_time=now,
                    priority=priority,
                    category=category,
                    domain=self.live_schema.replace("_", " ").title(),
                    concept_match="",
                    concept_confidence=conf,
                    similar_columns_metrics=[],
                    governance_timeline=[
                        {"stage": "Column Discovered in Live Catalog",
                         "timestamp": now.strftime("%Y-%m-%d %H:%M")},
                        {"stage": "AI Classified",
                         "timestamp": now.strftime("%Y-%m-%d %H:%M")}
                    ]
                ))

        # 1. SDK-first: uses WorkspaceClient metadata API — no SQL Warehouse needed
        if self.client:
            try:
                tables = list(self.client.tables.list(
                    catalog_name=self.live_catalog,
                    schema_name=self.live_schema
                ))
                logger.info(f"[SDK] Discovered {len(tables)} tables in {self.live_catalog}.{self.live_schema}")
                for t in tables:
                    if not t.columns:
                        continue
                    col_iter = [(col.name, col.type_text or str(col.type_name)) for col in t.columns]
                    _process_columns(t.name, col_iter)
                logger.info(f"[SDK] Scan complete: {len(items)} governance-relevant columns found.")
                return items
            except Exception as sdk_err:
                logger.warning(f"[SDK] Live catalog scan failed: {sdk_err}. Falling back to Spark SQL...")
                items.clear()

        # 2. Spark SQL fallback: works if SQL Warehouse or local Spark runtime is available
        if self.spark:
            try:
                tables_df = self.spark.sql(f"SHOW TABLES IN {self.live_catalog}.{self.live_schema}")
                tables = tables_df.collect()
                logger.info(f"[SQL] Discovered {len(tables)} tables in {self.live_catalog}.{self.live_schema}")
                for t_row in tables:
                    t_dict = t_row.asDict()
                    table_name = t_dict.get("tableName") or t_dict.get("table_name", "")
                    if not table_name:
                        continue
                    try:
                        cols_df = self.spark.sql(
                            f"DESCRIBE TABLE {self.live_catalog}.{self.live_schema}.{table_name}"
                        )
                        col_iter = [
                            (c.asDict().get("col_name", ""), c.asDict().get("data_type", "STRING"))
                            for c in cols_df.collect()
                        ]
                        _process_columns(table_name, col_iter)
                    except Exception as col_err:
                        logger.warning(f"[SQL] Could not describe table {table_name}: {col_err}")
            except Exception as e:
                logger.warning(f"[SQL] Live catalog scan failed: {e}. Falling back to mock data.")

        logger.info(f"Scan complete: {len(items)} governance-relevant columns found.")
        return items

    # ── Data access ───────────────────────────────────────────────────────────
    def get_pending_classifications(self) -> List[ClassificationItem]:
        """Fetch all classifications in the queue from session state."""
        return list(st.session_state.pending_reviews.values())

    def get_classification_by_id(self, item_id: str) -> Optional[ClassificationItem]:
        """Fetch a specific classification item by unique request ID."""
        return st.session_state.pending_reviews.get(item_id)

    def update_status(self, item_id: str, status: str, suggested_tag: Optional[str] = None) -> bool:
        """Update the status of a classification recommendation and optionally apply the tag in live Unity Catalog."""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        if item_id not in st.session_state.pending_reviews:
            return False

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
            # Apply the tag to the real table in Unity Catalog
            if self.spark:
                try:
                    fq_table = f"{self.live_catalog}.{self.live_schema}.{item.table_name}"
                    self.spark.sql(
                        f"ALTER TABLE {fq_table} ALTER COLUMN {item.column_name} SET TAGS ('{item.suggested_tag}')"
                    )
                    logger.info(f"Tag '{item.suggested_tag}' applied to {fq_table}.{item.column_name}")
                except Exception as e:
                    logger.warning(f"Could not apply tag in Unity Catalog: {e}")

        st.session_state.pending_reviews[item_id] = item
        return True
