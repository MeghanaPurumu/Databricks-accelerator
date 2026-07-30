import os
import streamlit as st
import logging
from utils.db import get_spark, get_workspace_client

logger = logging.getLogger("unity_catalog_service")

LIVE_CATALOG = os.environ.get("DATABRICKS_CATALOG", "dev")
LIVE_SCHEMA  = os.environ.get("DATABRICKS_SCHEMA",  "synthetic_data")

# Seeding Unity Catalog columns from the Healthcare Enterprise Data Model
INITIAL_UC_CATALOG = {
    "clinical.PATIENTS.tax_identifier": {
        "tag": "pii:ssn",
        "masking_policy": "MASK_FULL_SSN",
        "abac_policy": "StewardOrComplianceOnly",
        "class_date": "2026-07-01",
        "last_reviewer": "steward@enterprise.com",
        "status": "Approved"
    },
    "clinical.PATIENTS.phone_num": {
        "tag": "pii:phone",
        "masking_policy": "MASK_LAST_4",
        "abac_policy": "None",
        "class_date": "2026-07-05",
        "last_reviewer": "steward@enterprise.com",
        "status": "Approved"
    },
    "clinical.ENCOUNTERS.primary_diagnosis": {
        "tag": "phi:diagnosis",
        "masking_policy": "None",
        "abac_policy": "PhysicianOrCompliance",
        "class_date": "2026-07-10",
        "last_reviewer": "steward@enterprise.com",
        "status": "Approved"
    },
    "revenue_cycle.CLAIM_LINE_ITEMS.charge_amount": {
        "tag": "financial:amount",
        "masking_policy": "None",
        "abac_policy": "FinanceRoleOnly",
        "class_date": "2026-07-12",
        "last_reviewer": "compliance@enterprise.com",
        "status": "Approved"
    },
    "pharmacy.PRESCRIPTION_ITEMS.dosage_instructions": {
        "tag": "phi:prescription",
        "masking_policy": "None",
        "abac_policy": "None",
        "class_date": "2026-07-15",
        "last_reviewer": "steward@enterprise.com",
        "status": "Approved"
    }
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
        Scan dev.synthetic_data tables and columns via SHOW TABLES + DESCRIBE TABLE.
        Returns a unity_catalog dict keyed by schema.table.column.
        Falls back to empty dict on any error.
        """
        if not self.spark:
            return {}
        catalog = {}
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
                        # Skip partition headers and empty rows
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
                    logger.warning(f"Could not describe {table_name}: {col_err}")
        except Exception as e:
            logger.warning(f"Could not discover live catalog from {LIVE_CATALOG}.{LIVE_SCHEMA}: {e}")
        return catalog

    def get_live_table_list(self):
        """Returns list of real tables from dev.synthetic_data, or empty list on error."""
        if not self.spark:
            return []
        try:
            df = self.spark.sql(f"SHOW TABLES IN {LIVE_CATALOG}.{LIVE_SCHEMA}")
            rows = df.collect()
            return [r.asDict().get("tableName") or r.asDict().get("table_name", "") for r in rows]
        except Exception as e:
            logger.warning(f"Could not list tables: {e}")
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
                logger.warning(f"Failed to apply tag via SQL DDL: {e}. Trying SDK Client...")
                
                if self.client:
                    try:
                        self.client.catalog.update_column_tag(
                            schema_name=schema,
                            table_name=table,
                            column_name=column,
                            tag_name=tag
                        )
                        logger.info("Successfully applied tag via Databricks SDK REST Client.")
                    except Exception as sdk_err:
                        logger.error(f"Failed to apply tag via Databricks SDK: {sdk_err}")
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


