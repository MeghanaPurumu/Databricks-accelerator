import streamlit as st
import logging
from utils.db import get_spark, get_workspace_client

logger = logging.getLogger("unity_catalog_service")

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
            st.session_state.unity_catalog = INITIAL_UC_CATALOG.copy()

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
                query = f"ALTER TABLE {schema}.{table} ALTER COLUMN {column} SET TAGS ('{tag}')"
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
            schema, table, column = parts[0], parts[1], parts[2]
            
            if q in schema.lower() or q in table.lower() or q in column.lower() or q in meta["tag"].lower():
                results.append({
                    "schema": schema,
                    "table": table,
                    "column": column,
                    "tag": meta["tag"],
                    "masking_policy": meta["masking_policy"],
                    "abac_policy": meta["abac_policy"],
                    "class_date": meta["class_date"],
                    "last_reviewer": meta["last_reviewer"],
                    "status": meta["status"]
                })
        return results
