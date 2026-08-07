import os
import streamlit as st
import logging
from utils.db import get_spark, get_workspace_client

logger = logging.getLogger("unity_catalog_service")

LIVE_CATALOG = os.environ.get("DATABRICKS_CATALOG", "dev")
LIVE_SCHEMA  = os.environ.get("DATABRICKS_SCHEMA",  "brz")

# ── Rule-based column classifier (mirrors GovernanceService rules) ─────────────
# Maps keyword patterns → (tag, category)
COLUMN_TAG_RULES = [
    (["ssn", "social_security", "tax_id", "tax_identifier", "national_id"],  "pii:ssn",          "PII"),
    (["phone", "mobile", "cell", "telephone", "contact_number"],             "pii:phone",         "PII"),
    (["email", "email_address", "mail"],                                      "pii:email",         "PII"),
    (["first_name", "last_name", "full_name", "patient_name", "name"],        "pii:name",          "PII"),
    (["dob", "date_of_birth", "birth_date", "birthdate"],                     "pii:dob",           "PII"),
    (["address", "street", "city", "zip", "postal_code", "location"],         "pii:address",       "PII"),
    (["diagnosis", "icd", "icd_code", "icd10", "condition", "disease"],       "phi:diagnosis",     "PHI"),
    (["medication", "drug", "prescription", "dosage", "rx", "ndc"],           "phi:prescription",  "PHI"),
    (["mrn", "patient_id", "member_id", "encounter_id", "visit_id"],          "phi:patient_id",    "PHI"),
    (["lab", "result", "test_result", "observation", "specimen"],             "phi:lab_result",    "PHI"),
    (["npi", "provider_id", "physician_id", "dea_number", "physician", "attending"], "phi:provider_id", "PHI"),
    (["claim_amount", "charge", "payment", "amount", "billed", "cost"],       "financial:amount",  "Financial"),
    (["account", "bank", "routing", "credit_card", "card_number"],            "financial:account", "Financial"),
    (["insurance", "payer", "plan_id", "group_number", "policy_number"],      "pii:insurance",     "PII"),
]

def _classify_column_tag(col_name: str):
    """Returns (tag, category) for a column name using rule-based matching, or ('', 'Unknown')."""
    col_lower = col_name.lower()
    for keywords, tag, category in COLUMN_TAG_RULES:
        if any(kw in col_lower for kw in keywords):
            return tag, category
    return "", "Unknown"

# ── Known live tables in dev.brz ── seeded as offline fallback when SDK unavailable
LIVE_TABLES = [
    "claims_billing_phi",
    "classification_results",
    "healthcare_patients_financial",
]

# Fallback catalog — statuses properly reflect whether a column has a real tag
INITIAL_UC_CATALOG = {
    # claims_billing_phi — billing claim records with PHI data
    "brz.claims_billing_phi.patient_id": {
        "tag": "phi:patient_id", "masking_policy": "MASK_PATIENT_ID",
        "abac_policy": "PhysicianOrCompliance", "class_date": "2026-07-15",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.claims_billing_phi.claim_amount": {
        "tag": "financial:amount", "masking_policy": "None",
        "abac_policy": "FinanceRoleOnly", "class_date": "2026-07-15",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.claims_billing_phi.diagnosis_code": {
        "tag": "phi:diagnosis", "masking_policy": "None",
        "abac_policy": "PhysicianOrCompliance", "class_date": "2026-07-16",
        "last_reviewer": "compliance@enterprise.com", "status": "Classified"
    },
    "brz.claims_billing_phi.provider_id": {
        "tag": "phi:provider_id", "masking_policy": "None",
        "abac_policy": "None", "class_date": "2026-07-16",
        "last_reviewer": "", "status": "Pending Review"
    },
    # healthcare_patients_financial — patient financial records
    "brz.healthcare_patients_financial.patient_id": {
        "tag": "phi:patient_id", "masking_policy": "MASK_PATIENT_ID",
        "abac_policy": "PhysicianOrCompliance", "class_date": "2026-07-14",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.healthcare_patients_financial.account_number": {
        "tag": "financial:account", "masking_policy": "MASK_ACCOUNT",
        "abac_policy": "FinanceRoleOnly", "class_date": "2026-07-14",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.healthcare_patients_financial.insurance_id": {
        "tag": "pii:insurance", "masking_policy": "None",
        "abac_policy": "None", "class_date": "2026-07-18",
        "last_reviewer": "compliance@enterprise.com", "status": "Classified"
    },
    "brz.healthcare_patients_financial.date_of_birth": {
        "tag": "pii:dob", "masking_policy": "MASK_DOB",
        "abac_policy": "PhysicianOrCompliance", "class_date": "2026-07-18",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.healthcare_patients_financial.email_address": {
        "tag": "pii:email", "masking_policy": "MASK_EMAIL",
        "abac_policy": "None", "class_date": "2026-07-19",
        "last_reviewer": "steward@enterprise.com", "status": "Classified"
    },
    "brz.healthcare_patients_financial.phone_number": {
        "tag": "pii:phone", "masking_policy": "MASK_LAST_4",
        "abac_policy": "None", "class_date": "2026-07-19",
        "last_reviewer": "compliance@enterprise.com", "status": "Classified"
    },
    # classification_results — AI agent output metadata table (not classified itself)
    "brz.classification_results.column_name": {
        "tag": "", "masking_policy": "None",
        "abac_policy": "None", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
}


class UnityCatalogService:
    def __init__(self):
        self.spark = get_spark()
        self.client = get_workspace_client()
        self.using_live = False

        if "unity_catalog" not in st.session_state:
            live_catalog = self._discover_live_catalog()
            if live_catalog:
                st.session_state.unity_catalog = live_catalog
                self.using_live = True
                logger.info(f"Populated unity_catalog from live schema {LIVE_CATALOG}.{LIVE_SCHEMA}: {len(live_catalog)} columns discovered.")
            else:
                st.session_state.unity_catalog = INITIAL_UC_CATALOG.copy()
                logger.info("Using fallback UC catalog (no live connection).")
        else:
            # Re-check if live for status reporting
            self.using_live = st.session_state.get("uc_live_mode", False)

    def _load_classification_results(self) -> dict:
        """
        Load pre-existing tags from dev.brz.classification_results Delta table.
        Returns dict: {(table_name, col_name): {"tag": ..., "confidence": ...}}
        """
        results = {}
        if not self.spark:
            return results
        try:
            df = self.spark.sql(
                f"SELECT table_name, column_name, class_tag, confidence "
                f"FROM {LIVE_CATALOG}.{LIVE_SCHEMA}.classification_results"
            )
            for row in df.collect():
                r = row.asDict()
                t = (r.get("table_name", "").lower().strip(),
                     r.get("column_name", "").lower().strip())
                if t[0] and t[1]:
                    results[t] = {
                        "tag": r.get("class_tag", ""),
                        "confidence": r.get("confidence", "")
                    }
            logger.info(f"Loaded {len(results)} tags from classification_results.")
        except Exception as e:
            logger.warning(f"Could not load classification_results: {e}")
        return results

    def _discover_live_catalog(self) -> dict:
        """
        Scan LIVE_CATALOG.LIVE_SCHEMA tables and columns.
        Enriches every column with tags from classification_results table
        or falls back to rule-based classification.
        Uses pure Databricks SDK metadata list, falling back to Spark SQL.
        """
        catalog = {}

        # Load pre-existing classification metadata first
        pre_tags = self._load_classification_results()

        def _enrich_column(schema_name, table_name, col_name, data_type=""):
            """Build catalog entry for a single column with tag enrichment."""
            key = f"{schema_name}.{table_name}.{col_name}"
            tbl_lower = table_name.lower().strip()
            col_lower = col_name.lower().strip()

            # Skip classification_results table itself
            if tbl_lower == "classification_results":
                catalog[key] = {
                    "tag": "", "masking_policy": "None",
                    "abac_policy": "None", "class_date": "",
                    "last_reviewer": "", "status": "Unclassified",
                    "data_type": data_type
                }
                return

            # 1. Check live classification_results first
            pre = pre_tags.get((tbl_lower, col_lower), {})
            tag = pre.get("tag", "").strip()

            # 2. Fall back to rule-based classifier if no live tag
            if not tag or tag.lower() in ["unclassified", "none", ""]:
                tag, _ = _classify_column_tag(col_name)

            # Determine status and masking based on tag
            if tag:
                # Map tag to masking policy
                masking = "None"
                if "patient_id" in tag or "mrn" in tag:
                    masking = "MASK_PATIENT_ID"
                elif "ssn" in tag:
                    masking = "MASK_FULL_SSN"
                elif "dob" in tag or "birth" in tag:
                    masking = "MASK_DOB"
                elif "email" in tag:
                    masking = "MASK_EMAIL"
                elif "phone" in tag:
                    masking = "MASK_LAST_4"
                elif "account" in tag:
                    masking = "MASK_ACCOUNT"

                # Map tag to ABAC policy
                abac = "None"
                if "phi" in tag:
                    abac = "PhysicianOrCompliance"
                elif "financial" in tag:
                    abac = "FinanceRoleOnly"

                status = "Classified"
            else:
                masking = "None"
                abac = "None"
                status = "Unclassified"

            catalog[key] = {
                "tag": tag,
                "masking_policy": masking,
                "abac_policy": abac,
                "class_date": "2026-07-01" if tag else "",
                "last_reviewer": "system-agent" if tag else "",
                "status": status,
                "data_type": data_type
            }

        # 1. Try pure SDK metadata listing (doesn't require a SQL Warehouse)
        if self.client:
            try:
                tables = self.client.tables.list(catalog_name=LIVE_CATALOG, schema_name=LIVE_SCHEMA)
                for t in tables:
                    table_name = t.name
                    if not t.columns:
                        continue
                    for col in t.columns:
                        _enrich_column(LIVE_SCHEMA, table_name, col.name,
                                       col.type_text or str(col.type_name or "STRING"))
                logger.info(f"Successfully discovered {len(catalog)} columns via Databricks SDK.")
                st.session_state["uc_live_mode"] = True
                return catalog
            except Exception as sdk_err:
                logger.warning(f"SDK table discovery failed: {sdk_err}. Falling back to Spark/SQL...")

        # 2. Fallback to Spark/SQL if Spark session/wrapper is available
        if self.spark:
            try:
                tables_df = self.spark.sql(f"SHOW TABLES IN {LIVE_CATALOG}.{LIVE_SCHEMA}")
                tables = tables_df.collect()
                for row in tables:
                    table_name = row.asDict().get("tableName") or row.asDict().get("table_name", "")
                    if not table_name:
                        continue
                    try:
                        cols_df = self.spark.sql(f"DESCRIBE TABLE {LIVE_CATALOG}.{LIVE_SCHEMA}.{table_name}")
                        for col_row in cols_df.collect():
                            col_dict = col_row.asDict()
                            col_name = col_dict.get("col_name", "")
                            data_type = col_dict.get("data_type", "")
                            if not col_name or col_name.startswith("#") or not data_type:
                                continue
                            _enrich_column(LIVE_SCHEMA, table_name, col_name, data_type)
                    except Exception as col_err:
                        logger.warning(f"Could not describe {table_name} via SQL: {col_err}")
                st.session_state["uc_live_mode"] = True
                logger.info(f"Discovered {len(catalog)} columns via Spark SQL.")
            except Exception as e:
                logger.warning(f"Could not discover live catalog via Spark SQL: {e}")

        return catalog

    def get_live_table_list(self):
        """Returns list of real tables from live catalog/schema, or empty list on error."""
        if self.client:
            try:
                tables = self.client.tables.list(catalog_name=LIVE_CATALOG, schema_name=LIVE_SCHEMA)
                return [t.name for t in tables]
            except Exception as sdk_err:
                logger.warning(f"SDK table list failed: {sdk_err}. Trying Spark/SQL...")

        if self.spark:
            try:
                df = self.spark.sql(f"SHOW TABLES IN {LIVE_CATALOG}.{LIVE_SCHEMA}")
                rows = df.collect()
                return [r.asDict().get("tableName") or r.asDict().get("table_name", "") for r in rows]
            except Exception as e:
                logger.warning(f"Could not list tables via SQL: {e}")

        return []

    def get_column_metadata(self, schema: str, table: str, column: str):
        """Retrieve governance metadata (tags, masking policy, ABAC rules) for a column."""
        key = f"{schema}.{table}.{column}"
        return st.session_state.unity_catalog.get(key)

    def apply_column_tag(self, schema: str, table: str, column: str, tag: str, user_email: str) -> bool:
        """
        Executes tag updates in Unity Catalog.
        Calls direct ALTER TABLE SQL or SDK REST APIs on active Databricks connections.
        """
        key = f"{schema}.{table}.{column}"
        logger.info(f"Unity Catalog API Call: Setting tag '{tag}' on {key} by {user_email}")

        if self.spark:
            try:
                qualified = f"{LIVE_CATALOG}.{schema}.{table}"
                query = f"ALTER TABLE {qualified} ALTER COLUMN {column} SET TAGS ('{tag}')"
                self.spark.sql(query)
                logger.info(f"Successfully applied tag {tag} via Spark SQL DDL.")
            except Exception as e:
                logger.error(f"Failed to apply tag via SQL DDL: {e}")
                return False

        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")

        if key not in st.session_state.unity_catalog:
            st.session_state.unity_catalog[key] = {
                "tag": tag,
                "masking_policy": "None",
                "abac_policy": "None",
                "class_date": today,
                "last_reviewer": user_email,
                "status": "Classified"
            }
        else:
            st.session_state.unity_catalog[key]["tag"] = tag
            st.session_state.unity_catalog[key]["last_reviewer"] = user_email
            st.session_state.unity_catalog[key]["class_date"] = today
            st.session_state.unity_catalog[key]["status"] = "Classified"

        return True

    def search_catalog(self, query: str):
        """Search table, column, or tag metadata within Unity Catalog."""
        results = []
        q = query.lower()

        for key, meta in st.session_state.unity_catalog.items():
            parts = key.split(".")
            if len(parts) < 3:
                continue
            schema, table, column = parts[0], parts[1], parts[2]

            if q in schema.lower() or q in table.lower() or q in column.lower() or q in meta.get("tag", "").lower():
                results.append({
                    "schema": schema,
                    "table": table,
                    "column": column,
                    "tag": meta.get("tag", ""),
                    "masking_policy": meta.get("masking_policy", "None"),
                    "abac_policy": meta.get("abac_policy", "None"),
                    "class_date": meta.get("class_date", ""),
                    "last_reviewer": meta.get("last_reviewer", ""),
                    "status": meta.get("status", "Unclassified")
                })
        return results
