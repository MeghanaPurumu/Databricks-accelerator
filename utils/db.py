import os
import sys
import logging

logger = logging.getLogger("db_connector")

_spark_session = None
_workspace_client = None
_warehouse_id = None
_checked_databricks = False
_active_wrapper = None

class DatabricksSQLRow:
    def __init__(self, data_dict):
        self._dict = data_dict
        
    def asDict(self):
        return self._dict
        
    def __getitem__(self, key):
        return self._dict[key]

class DatabricksSQLDataFrame:
    def __init__(self, data_list):
        self._data = data_list
        
    def collect(self):
        return [DatabricksSQLRow(r) for r in self._data]
        
    def toPandas(self):
        import pandas as pd
        return pd.DataFrame(self._data)
        
    @property
    def write(self):
        global _active_wrapper
        return DatabricksSQLWriter(_active_wrapper, self._data)

class DatabricksSQLWriter:
    def __init__(self, wrapper, data):
        self.wrapper = wrapper
        self.data = data
        self._mode = "overwrite"
        
    def format(self, fmt):
        return self
        
    def mode(self, m):
        self._mode = m
        return self
        
    def saveAsTable(self, table_name):
        if self.wrapper:
            self.wrapper.bootstrap_table(table_name, self.data, self._mode)

class DatabricksSQLWrapper:
    def __init__(self, client, warehouse_id):
        global _active_wrapper
        self.client = client
        self.warehouse_id = warehouse_id
        _active_wrapper = self
        logger.info(f"Initialized DatabricksSQLWrapper for SQL Warehouse {warehouse_id}")

    def sql(self, query: str):
        logger.info(f"Executing statement on warehouse {self.warehouse_id}: {query[:100]}...")
        
        # Strip trailing semicolon if present to prevent parsing errors in statement API
        stmt = query.strip()
        if stmt.endswith(";"):
            stmt = stmt[:-1]
            
        response = self.client.statement_execution.execute_statement(
            sql_statement=stmt,
            warehouse_id=self.warehouse_id
        )
        
        import time
        statement_id = response.statement_id
        # Wait/poll for the statement execution to complete
        while response.status.state.value in ['PENDING', 'RUNNING']:
            time.sleep(0.5)
            response = self.client.statement_execution.get_statement(statement_id)
            
        if response.status.state.value != 'SUCCEEDED':
            error_msg = response.status.error.message if response.status.error else "Execution failed"
            raise Exception(f"SQL statement execution failed: {error_msg}")
            
        data = []
        if response.result and response.result.data_array:
            columns = [col.name for col in response.manifest.schema.columns]
            for row in response.result.data_array:
                data.append(dict(zip(columns, row)))
                
        return DatabricksSQLDataFrame(data)

    def createDataFrame(self, data_list):
        return DatabricksSQLDataFrame(data_list)

    def bootstrap_table(self, table_name, data, mode):
        # Prevent drop/truncate if table already exists in live catalog
        try:
            self.sql(f"DESCRIBE TABLE {table_name}")
            logger.info(f"Table '{table_name}' already exists. Skipping bootstrap to prevent data loss.")
            return
        except Exception:
            pass
            
        if not data:
            return
            
        # Dynamically compile the CREATE TABLE DDL
        first_row = data[0]
        columns_ddl = []
        for col_name, val in first_row.items():
            if isinstance(val, int):
                col_type = "INT"
            elif isinstance(val, float):
                col_type = "DOUBLE"
            elif isinstance(val, str):
                col_type = "STRING"
            else:
                col_type = "STRING"
            columns_ddl.append(f"{col_name} {col_type}")
            
        columns_str = ", ".join(columns_ddl)
        create_query = f"CREATE TABLE IF NOT EXISTS {table_name} ({columns_str}) USING DELTA"
        self.sql(create_query)
        
        # Batch insert initial seed values
        for row in data:
            cols = []
            vals = []
            for k, v in row.items():
                cols.append(k)
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                else:
                    escaped_val = str(v).replace("'", "\\'")
                    vals.append(f"'{escaped_val}'")
            cols_str = ", ".join(cols)
            vals_str = ", ".join(vals)
            insert_query = f"INSERT INTO {table_name} ({cols_str}) VALUES ({vals_str})"
            self.sql(insert_query)

def is_databricks() -> bool:
    """Checks if we are running in an active Databricks environment with live connection."""
    global _checked_databricks, _spark_session, _workspace_client, _warehouse_id
    if not _checked_databricks:
        # ── Spark Session check ────────────────────────────────────────────────
        _old_stderr = sys.stderr
        try:
            sys.stderr = open(os.devnull, "w")
            from pyspark.sql import SparkSession
            spark = SparkSession.builder.master("local").appName("GovernX-probe").getOrCreate()
            spark.sql("SELECT 1")
            _spark_session = spark
            logger.info("Local Spark Session successfully initialized.")
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
            
            # Retrieve SQL Warehouse ID if configured or automatically discover it
            wh_id = os.environ.get("DATABRICKS_WAREHOUSE_ID")
            if not wh_id:
                warehouses = list(client.warehouses.list())
                if warehouses:
                    wh_id = warehouses[0].id
                    
            _warehouse_id = wh_id
            logger.info(f"Live Databricks WorkspaceClient connection established. Warehouse: {_warehouse_id}")
        except Exception as e:
            logger.debug(f"WorkspaceClient connection failed: {e}")
            _workspace_client = None

        _checked_databricks = True

    return _spark_session is not None or (_workspace_client is not None and _warehouse_id is not None)

def get_spark():
    """Retrieve active SparkSession, custom SQL execution wrapper, or None."""
    global _spark_session, _workspace_client, _warehouse_id
    if is_databricks():
        if _spark_session:
            return _spark_session
        if _workspace_client and _warehouse_id:
            return DatabricksSQLWrapper(_workspace_client, _warehouse_id)
    return None

def get_workspace_client():
    """Retrieve active WorkspaceClient or None."""
    if is_databricks():
        return _workspace_client
    return None
