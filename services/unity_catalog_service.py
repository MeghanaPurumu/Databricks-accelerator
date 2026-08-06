import os
import streamlit as st
import logging
from utils.db import get_spark, get_workspace_client

logger = logging.getLogger("unity_catalog_service")

LIVE_CATALOG = os.environ.get("DATABRICKS_CATALOG", "dev")
LIVE_SCHEMA  = os.environ.get("DATABRICKS_SCHEMA",  "brz")

# ── Known live tables in dev.brz ── seeded as offline fallback when SDK unavailable
# These will be OVERWRITTEN by live catalog discovery when running on Databricks
LIVE_TABLES = [
    "claims_billing_phi",
    "classification_results",
    "healthcare_patient_financial",
]

INITIAL_UC_CATALOG = {
    # claims_billing_phi — billing claim records with PHI data
    "brz.claims_billing_phi.patient_id": {
        "tag": "phi:patient_id", "masking_policy": "MASK_PATIENT_ID",
        "abac_policy": "PhysicianOrCompliance", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    "brz.claims_billing_phi.claim_amount": {
        "tag": "financial:amount", "masking_policy": "None",
        "abac_policy": "FinanceRoleOnly", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    "brz.claims_billing_phi.diagnosis_code": {
        "tag": "phi:diagnosis", "masking_policy": "None",
        "abac_policy": "PhysicianOrCompliance", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    "brz.claims_billing_phi.provider_id": {
        "tag": "phi:provider_id", "masking_policy": "None",
        "abac_policy": "None", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    # healthcare_patient_financial — patient financial records
    "brz.healthcare_patient_financial.patient_id": {
        "tag": "phi:patient_id", "masking_policy": "MASK_PATIENT_ID",
        "abac_policy": "PhysicianOrCompliance", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    "brz.healthcare_patient_financial.account_number": {
        "tag": "financial:account", "masking_policy": "MASK_ACCOUNT",
        "abac_policy": "FinanceRoleOnly", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    "brz.healthcare_patient_financial.insurance_id": {
        "tag": "pii:insurance", "masking_policy": "None",
        "abac_policy": "None", "class_date": "",
        "last_reviewer": "", "status": "Unclassified"
    },
    # classification_results — AI agent classification output table
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
        
        if "unity_catalog" not in st.session_state:
            # Try to populate from the live dev.synthetic_data schema
            live_catalog = self._discover_live_catalog()
            if live_catalog:
                st.session_state.unity_catalog = live_catalog
                logger.info(f"Populated unity_catalog from live schema {LIVE_CATALOG}.{LIVE_SCHEMA}: {len(live_catalog)} columns discovered.")
            else:
                st.session_state.unity_catalog = INITIAL_UC_CATALOG.copy()

    def _discover_live_catalog(self) -> dict:
        """
        Scan LIVE_CATALOG.LIVE_SCHEMA tables and columns.
        Uses pure Databricks SDK metadata list, falling back to Spark SQL.
        """
        catalog = {}
        
        # 1. Try pure SDK metadata listing (doesn't require a SQL Warehouse)
        if self.client:
            try:
                tables = self.client.tables.list(catalog_name=LIVE_CATALOG, schema_name=LIVE_SCHEMA)
                for t in tables:
                    table_name = t.name
                    if not t.columns:
                        continue
                    for col in t.columns:
                        key = f"{LIVE_SCHEMA}.{table_name}.{col.name}"
                        catalog[key] = {
                            "tag": "",
                            "masking_policy": "None",
                            "abac_policy": "None",
                            "class_date": "",
                            "last_reviewer": "",
                            "status": "Unclassified",
                            "data_type": col.type_text or col.type_name
                        }
                logger.info(f"Successfully discovered {len(catalog)} columns via Databricks SDK.")
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
                            key = f"{LIVE_SCHEMA}.{table_name}.{col_name}"
                            catalog[key] = {
                                "tag": "",
                                "masking_policy": "None",
                                "abac_policy": "None",
                                "class_date": "",
                                "last_reviewer": "",
                                "status": "Unclassified",
                                "data_type": data_type
                            }
                    except Exception as col_err:
                        logger.warning(f"Could not describe {table_name} via SQL: {col_err}")
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
                # Use fully-qualified table name in case schema context differs
                qualified = f"{LIVE_CATALOG}.{schema}.{table}"
                query = f"ALTER TABLE {qualified} ALTER COLUMN {column} SET TAGS ('{tag}')"
                self.spark.sql(query)
                logger.info(f"Successfully applied tag {tag} via Spark SQL DDL.")
            except Exception as e:
                logger.error(f"Failed to apply tag via SQL DDL: {e}")
                return False
        
        # Keep mock state synced so changes are visible locally
        if key not in st.session_state.unity_catalog:
            st.session_state.unity_catalog[key] = {
                "tag": tag,
                "masking_policy": "None",
                "abac_policy": "None",
                "class_date": "2026-07-23",
                "last_reviewer": user_email,
                "status": "Approved"
            }
        else:
            st.session_state.unity_catalog[key]["tag"] = tag
            st.session_state.unity_catalog[key]["last_reviewer"] = user_email
            st.session_state.unity_catalog[key]["class_date"] = "2026-07-23"
            st.session_state.unity_catalog[key]["status"] = "Approved"
            
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


