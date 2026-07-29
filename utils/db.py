import os
import sys
import logging

logger = logging.getLogger("db_connector")

_spark_session = None
_workspace_client = None
_checked_databricks = False

def is_databricks() -> bool:
    """Checks if we are running in an active Databricks environment with live connection."""
    global _checked_databricks, _spark_session, _workspace_client
    if not _checked_databricks:
        # ── Spark Session check ────────────────────────────────────────────────
        # Redirect stderr to /dev/null while probing for Spark/Java
        # so that "Java not found" messages never appear in the Streamlit console.
        _old_stderr = sys.stderr
        try:
            sys.stderr = open(os.devnull, "w")
            from pyspark.sql import SparkSession
            spark = SparkSession.builder.master("local").appName("GovernX-probe").getOrCreate()
            spark.sql("SELECT 1")
            _spark_session = spark
        except Exception:
            _spark_session = None
        finally:
            try:
                sys.stderr.close()
            except Exception:
                pass
            sys.stderr = _old_stderr

        # ── Databricks SDK WorkspaceClient check ──────────────────────────────
        try:
            from databricks.sdk import WorkspaceClient
            client = WorkspaceClient()
            client.current_user.me()
            _workspace_client = client
            logger.info("Live Databricks WorkspaceClient connection established.")
        except Exception:
            _workspace_client = None

        _checked_databricks = True

    return _spark_session is not None or _workspace_client is not None

def get_spark():
    """Retrieve active SparkSession or None."""
    if is_databricks():
        return _spark_session
    return None

def get_workspace_client():
    """Retrieve active WorkspaceClient or None."""
    if is_databricks():
        return _workspace_client
    return None
