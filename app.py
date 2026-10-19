from __future__ import annotations

import os
import re
import sys
import tempfile
import time
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests
import streamlit as st
from databricks import sql
from pyspark.sql import SparkSession
from pyspark.sql.types import StringType, StructField, StructType
from splink.backends.spark import similarity_jar_location

from new_mdm_engine import build_mdm


st.set_page_config(
    page_title="Databricks MDM",
    page_icon="D",
    layout="wide",
    initial_sidebar_state="expanded",
)
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    :root {
        --lf-canvas: #f9f5f3;
        --lf-surface: #ffffff;
        --lf-ink: #181516;
        --lf-muted: #5d6c7b;
        --lf-border: #e5e7eb;
        --lf-red: #ea384c;
        --lf-blue-gray: #758696;
        --lf-soft: #f0f1f3;
    }
    .stApp, .stApp button, .stApp input, .stApp textarea, .stApp [data-testid] {
        font-family: Inter, Arial, sans-serif;
    }
    .stApp { background: var(--lf-canvas); color: var(--lf-ink); }
    div[data-testid="stHeadingWithActionElements"] h1,
    div[data-testid="stHeadingWithActionElements"] h2,
    div[data-testid="stHeadingWithActionElements"] h3 {
        font-family: Inter, Arial, sans-serif !important; color: var(--lf-ink); font-weight: 650; }
    h1 { font-size: 2.2rem !important; margin-bottom: 0.25rem !important; }
    [data-testid="stSidebar"] { background: var(--lf-surface); border-right: 1px solid var(--lf-border); }
    [data-testid="stMetric"] { background: var(--lf-surface); border: 1px solid var(--lf-border); padding: 12px 14px; border-radius: 6px; }
    .status-label { color: var(--lf-red); font: 700 11px Inter, Arial, sans-serif; letter-spacing: 1px; }
    </style>
    """,
    unsafe_allow_html=True,
)


def _clear_session() -> None:
    for key in list(st.session_state.keys()):
        del st.session_state[key]


def _set_active_page(page: str) -> None:
    st.session_state["active_page"] = page


def _set_dashboard_view(view: str) -> None:
    st.session_state["dashboard_view"] = view


def _host_url(value: str) -> str:
    value = value.strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Enter the full Databricks workspace URL, beginning with https://.")
    return value


def _api_get(host: str, token: str, endpoint: str) -> dict:
    response = requests.get(
        f"{host}{endpoint}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=(5, 30),
    )
    response.raise_for_status()
    return response.json()


def _quote_identifier(identifier: str) -> str:
    return "`" + identifier.replace("`", "``") + "`"


def _query(host: str, token: str, warehouse_id: str, statement: str) -> tuple[list[str], list[tuple]]:
    connection = sql.connect(
        server_hostname=urlparse(host).netloc,
        http_path=f"/sql/1.0/warehouses/{warehouse_id}",
        access_token=token,
    )
    cursor = connection.cursor()
    try:
        cursor.execute(statement)
        columns = [item[0] for item in cursor.description or []]
        return columns, cursor.fetchall()
    finally:
        cursor.close()
        connection.close()


def _workspace_tables(host: str, token: str) -> list[dict]:
    result = _api_get(host, token, "/api/2.0/sql/warehouses")
    return result.get("warehouses", [])


def _prepare_local_spark_runtime() -> None:
    temp_dir = Path(tempfile.gettempdir())
    java_root = temp_dir / "openjdk17"
    if not os.environ.get("JAVA_HOME") and java_root.exists():
        candidates = list(java_root.glob("jdk-*/bin/java.exe"))
        if candidates:
            os.environ["JAVA_HOME"] = str(candidates[0].parent.parent)
    if os.environ.get("JAVA_HOME"):
        os.environ["PATH"] = str(Path(os.environ["JAVA_HOME"]) / "bin") + os.pathsep + os.environ["PATH"]

    hadoop_home = temp_dir / "hadoop-winutils-3.3.6"
    if not os.environ.get("HADOOP_HOME") and (hadoop_home / "bin" / "winutils.exe").exists():
        os.environ["HADOOP_HOME"] = str(hadoop_home)
        os.environ["PATH"] = str(hadoop_home / "bin") + os.pathsep + os.environ["PATH"]

    os.environ.setdefault("SPARK_LOCAL_IP", "127.0.0.1")
    os.environ.setdefault("SPARK_LOCAL_HOSTNAME", "localhost")
    os.environ.setdefault("PYSPARK_PYTHON", sys.executable)


def _safe_column_names(columns: list[str]) -> list[str]:
    result = []
    used = set()
    for index, name in enumerate(columns, start=1):
        cleaned = re.sub(r"[^A-Za-z0-9_]", "_", name).strip("_") or f"column_{index}"
        if cleaned[0].isdigit():
            cleaned = f"column_{cleaned}"
        base = cleaned
        suffix = 2
        while cleaned.lower() in used:
            cleaned = f"{base}_{suffix}"
            suffix += 1
        used.add(cleaned.lower())
        result.append(cleaned)
    return result


@st.cache_resource(show_spinner=False)
def _local_spark_session() -> SparkSession:
    _prepare_local_spark_runtime()
    warehouse_path = Path(tempfile.gettempdir()) / "spark-mdm-ui-warehouse"
    (warehouse_path / "default.db").mkdir(parents=True, exist_ok=True)
    return (
        SparkSession.builder.master("local[2]")
        .appName("databricks-mdm-ui")
        .config("spark.ui.enabled", "false")
        .config("spark.driver.extraClassPath", similarity_jar_location())
        .config("spark.sql.warehouse.dir", warehouse_path.as_uri())
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.driver.bindAddress", "127.0.0.1")
        .getOrCreate()
    )


def _load_table(
    host: str,
    token: str,
    warehouse_id: str,
    catalog: str,
    schema: str,
    table: str,
    row_limit: int,
) -> tuple[list[str], list[tuple]]:
    qualified = ".".join(_quote_identifier(part) for part in (catalog, schema, table))
    columns, rows = _query(host, token, warehouse_id, f"SELECT * FROM {qualified} LIMIT {int(row_limit)}")
    return _safe_column_names(columns), rows


def _run_local_mdm(
    host: str,
    token: str,
    warehouse_id: str,
    catalog: str,
    schema: str,
    tables: list[str],
    row_limit: int,
    threshold: float,
) -> tuple[pd.DataFrame, pd.DataFrame, int]:
    spark = _local_spark_session()
    view_names = []
    source_count = 0
    for index, table in enumerate(tables, start=1):
        columns, rows = _load_table(
            host, token, warehouse_id, catalog, schema, table, row_limit
        )
        if not columns:
            raise ValueError(f"Table {table} has no columns.")
        table_schema = StructType([StructField(name, StringType(), True) for name in columns])
        string_rows = [
            tuple(None if value is None else str(value) for value in row)
            for row in rows
        ]
        view_name = f"source_{index}_{re.sub(r'[^A-Za-z0-9_]', '_', table)}"
        spark.createDataFrame(string_rows, schema=table_schema).createOrReplaceTempView(view_name)
        view_names.append(view_name)
        source_count += len(string_rows)

    mdm_temp, mdm_final = build_mdm(
        spark,
        view_names,
        match_probability_threshold=threshold,
    )
    temp_result = mdm_temp.toPandas()
    final_result = mdm_final.toPandas()
    return temp_result, final_result, source_count


def _run_pipeline(
    catalog: str,
    schema: str,
    tables: list[str],
    row_limit: int,
    threshold: float,
) -> None:
    started = time.perf_counter()
    run_id = f"RUN-MDM-{uuid.uuid4().hex[:6].upper()}"
    run_record = {
        "run_id": run_id,
        "pipeline": "Customer MDM Pipeline",
        "domain": "Customer MDM",
        "executed_at": datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"),
        "status": "FAILED",
        "rows_ingested": 0,
        "golden_created": 0,
        "duration_seconds": 0.0,
        "sources": list(tables),
        "error": "",
    }
    try:
        with st.spinner("Reading selected rows and running Spark/Splink matching locally…"):
            temp_result, final_result, source_count = _run_local_mdm(
                st.session_state["host"],
                st.session_state["token"],
                st.session_state["warehouse_id"],
                catalog,
                schema,
                tables,
                row_limit,
                threshold,
            )
        run_record.update(
            status="SUCCESS",
            rows_ingested=source_count,
            golden_created=len(final_result),
        )
        st.session_state["mdm_result"] = {
            "temp": temp_result,
            "final": final_result,
            "source_count": source_count,
        }
        st.session_state["last_sources"] = list(tables)
        st.session_state["last_scope"] = f"{catalog}.{schema}"
    except Exception as exc:
        token = st.session_state.get("token", "")
        message = str(exc).replace(token, "[redacted]") if token else str(exc)
        run_record["error"] = message
        st.error(f"MDM run failed: {message}")
    finally:
        run_record["duration_seconds"] = round(time.perf_counter() - started, 1)
        history = st.session_state.setdefault("pipeline_runs", [])
        history.insert(0, run_record)


st.markdown(
    """
    <style>
    .stApp { background: var(--lf-canvas); color: var(--lf-ink); }
    [data-testid="stSidebar"] { background: var(--lf-surface); border-right: 1px solid var(--lf-border); }
    [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color: var(--lf-muted); }
    .brand-mark { display:inline-flex; width:34px; height:34px; align-items:center; justify-content:center;
        border-radius:10px; color:var(--lf-red); background:var(--lf-ink); border:1px solid var(--lf-blue-gray); font-size:19px; font-weight:700; margin-right:9px; }
    .brand-name { color:var(--lf-ink); font-weight:750; font-size:18px; vertical-align:middle; }
    .brand-caption { color:var(--lf-red); font-size:11px; font-weight:700; letter-spacing:1px; margin-left:44px; margin-top:-4px; }
    .section-label { color:var(--lf-blue-gray); font-size:10px; font-weight:750; letter-spacing:1.3px; margin:18px 0 2px; }
    .eyebrow { color:var(--lf-red); font-size:11px; font-weight:750; letter-spacing:1.5px; }
    .hero-copy { color:var(--lf-muted); font-size:15px; line-height:1.5; max-width:620px; }
    .run-success { color:#008e67; font-weight:700; }
    .run-failed { color:var(--lf-red); font-weight:700; }
    div[data-testid="stMetric"] { background:var(--lf-surface); border:1px solid var(--lf-border); border-radius:6px; padding:14px 16px; }
    div.stButton > button[kind="primary"], [data-testid="stFormSubmitButton"] button {
        background:var(--lf-ink) !important; border-color:var(--lf-red) !important; color:#fff !important; }
    div.stButton > button[kind="primary"]:hover, [data-testid="stFormSubmitButton"] button:hover {
        background:#2f3237 !important; border-color:var(--lf-red) !important; }
    [data-testid="stSegmentedControl"] { background:var(--lf-soft); border:1px solid var(--lf-border); border-radius:6px; padding:3px; }
    [data-testid="stBaseButton-segmented_controlActive"] {
        background:var(--lf-ink) !important; color:#fff !important; border:1px solid var(--lf-red) !important; }
    [data-baseweb="button-group"] button[kind="segmented_control"] { color:var(--lf-muted) !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

with st.sidebar:
    st.markdown('<div><span class="brand-mark">✦</span><span class="brand-name">MDM</span></div><div class="brand-caption">MDM PLATFORM</div>', unsafe_allow_html=True)
    st.divider()
    active_page = st.session_state.get("active_page", "Dashboard")
    st.button(
        "▦   Dashboard",
        type="primary" if active_page == "Dashboard" else "tertiary",
        use_container_width=True,
        key="nav_dashboard",
        on_click=_set_active_page,
        args=("Dashboard",),
    )
    st.markdown('<div class="section-label">CORE DATA</div>', unsafe_allow_html=True)
    with st.expander("Master Data", expanded=True):
        for page, label in (
            ("Master Data Hub", "◉   Master Data Hub"),
            ("Customer MDM", "♙   Customer MDM"),
            ("Product MDM", "♙   Product MDM"),
            ("Vendor MDM", "♙   Vendor MDM"),
            ("Employee MDM", "♙   Employee MDM"),
            ("Location", "⌖   Location"),
        ):
            st.button(
                label,
                type="primary" if active_page == page else "tertiary",
                use_container_width=True,
                key=f"nav_{page.lower().replace(' ', '_')}",
                on_click=_set_active_page,
                args=(page,),
            )
    st.markdown('<div class="section-label">GOVERNANCE</div>', unsafe_allow_html=True)
    for page, label in (
        ("Stewardship", "▤   Stewardship"),
        ("Data Quality", "◇   Data Quality"),
        ("Data Lineage", "⌘   Data Lineage"),
    ):
        st.button(
            label,
            type="primary" if active_page == page else "tertiary",
            use_container_width=True,
            key=f"nav_{page.lower().replace(' ', '_')}",
            on_click=_set_active_page,
            args=(page,),
        )
    st.markdown('<div class="section-label">CONNECTION</div>', unsafe_allow_html=True)
    if st.session_state.get("connected"):
        st.success("Databricks connected")
        st.caption(st.session_state.get("host", ""))
        st.button("Disconnect", on_click=_clear_session, use_container_width=True)
    else:
        st.caption("No workspace connected")

if active_page != "Dashboard":
    sidebar_page = active_page
    st.title(sidebar_page)
    st.info("This area is planned for a later step. The Dashboard, connection flow, and pipeline history are available now.")
    st.stop()

top_left, top_search, top_status = st.columns([1.05, 1.15, 0.8], vertical_alignment="center")
with top_left:
    st.markdown("**Dashboard**")
with top_search:
    search_text = st.text_input("Search records", placeholder="Search records…", label_visibility="collapsed")
with top_status:
    if st.session_state.get("connected"):
        st.markdown('<span class="run-success">● CONNECTED</span>', unsafe_allow_html=True)
    else:
        st.caption("● Not connected")

st.markdown('<div class="eyebrow">✧ &nbsp; MDM STUDIO CONTROL CENTER</div>', unsafe_allow_html=True)
if "dashboard_view" not in st.session_state:
    st.session_state["dashboard_view"] = "Overview"
hero_title, hero_tabs = st.columns([1.15, 1], vertical_alignment="center")
with hero_title:
    st.markdown("## Master Data & Integration Dashboard")
    st.markdown('<div class="hero-copy">Monitor Databricks connections, source ingestion, and MDM pipeline execution history.</div>', unsafe_allow_html=True)
with hero_tabs:
    dashboard_view = st.segmented_control(
        "Dashboard views",
        options=["Overview", "Connection & Ingestion", "Pipeline Runs"],
        default=st.session_state["dashboard_view"],
        label_visibility="collapsed",
        key="dashboard_view",
        width="stretch",
    )
st.divider()

if dashboard_view == "Connection & Ingestion":
    st.subheader("Connection & Ingestion")
    if not st.session_state.get("connected"):
        with st.form("workspace_connection"):
            host_column, token_column = st.columns(2)
            with host_column:
                host_input = st.text_input("Workspace URL", placeholder="https://<workspace>.cloud.databricks.com")
            with token_column:
                token_input = st.text_input("Personal access token", type="password")
            warehouse_input = st.text_input("SQL warehouse ID", placeholder="Paste your warehouse ID")
            connect_workspace = st.form_submit_button("Connect to Databricks", type="primary", use_container_width=False)
        if connect_workspace:
            try:
                host = _host_url(host_input)
                if not token_input.strip():
                    raise ValueError("Enter a personal access token.")
                if not warehouse_input.strip():
                    raise ValueError("Enter the SQL warehouse ID.")
                warehouses = _workspace_tables(host, token_input.strip())
                st.session_state.update(
                    host=host,
                    token=token_input.strip(),
                    warehouse_id=warehouse_input.strip(),
                    warehouses=warehouses,
                    connected=True,
                    catalogs=[],
                    schemas={},
                    tables=[],
                )
                st.rerun()
            except Exception as exc:
                safe_message = str(exc).replace(token_input, "[redacted]") if token_input else str(exc)
                st.error(safe_message)
    else:
        st.success(f"Connected to {st.session_state['host']} · warehouse {st.session_state['warehouse_id']}")
        if st.button("Load catalogs", type="primary"):
            try:
                _, rows = _query(
                    st.session_state["host"], st.session_state["token"],
                    st.session_state["warehouse_id"], "SHOW CATALOGS",
                )
                st.session_state["catalogs"] = [str(row[0]) for row in rows]
                st.session_state["catalog_error"] = None
            except Exception as exc:
                st.session_state["catalog_error"] = str(exc)
        if st.session_state.get("catalog_error"):
            st.error(st.session_state["catalog_error"])

        catalogs = st.session_state.get("catalogs", [])
        if catalogs:
            catalog = st.selectbox("Catalog", catalogs)
            if st.button("Load schemas", key="load_schemas"):
                try:
                    _, rows = _query(
                        st.session_state["host"], st.session_state["token"],
                        st.session_state["warehouse_id"],
                        f"SHOW SCHEMAS IN {_quote_identifier(catalog)}",
                    )
                    st.session_state["schemas"] = {catalog: [str(row[0]) for row in rows]}
                except Exception as exc:
                    st.error(str(exc))

            schemas = st.session_state.get("schemas", {}).get(catalog, [])
            if schemas:
                schema = st.selectbox("Schema", schemas)
                if st.button("Load tables", key="load_tables"):
                    try:
                        _, rows = _query(
                            st.session_state["host"], st.session_state["token"],
                            st.session_state["warehouse_id"],
                            f"SHOW TABLES IN {_quote_identifier(catalog)}.{_quote_identifier(schema)}",
                        )
                        st.session_state["tables"] = [str(row[1]) for row in rows]
                        st.session_state["table_scope"] = (catalog, schema)
                    except Exception as exc:
                        st.error(str(exc))

                tables = st.session_state.get("tables", []) if st.session_state.get("table_scope") == (catalog, schema) else []
                if tables:
                    defaults = [name for name in ("crm_customers", "banking_customers", "creditcard_customers") if name in tables]
                    selected_tables = st.multiselect("Source tables, ordered by priority", tables, default=defaults)
                    input_column, threshold_column = st.columns(2)
                    with input_column:
                        row_limit = st.number_input("Maximum rows per source", min_value=1, max_value=10000, value=2000, step=500)
                    with threshold_column:
                        threshold = st.slider("Match probability threshold", min_value=0.0, max_value=1.0, value=0.5, step=0.05)
                    if st.button("Run MDM", type="primary", disabled=not selected_tables):
                        _run_pipeline(catalog, schema, selected_tables, int(row_limit), float(threshold))
        else:
            st.info("Load catalogs to browse the data available to this workspace account.")

elif dashboard_view == "Overview":
    result = st.session_state.get("mdm_result")
    history = st.session_state.get("pipeline_runs", [])
    latest = history[0] if history else None
    metric_columns = st.columns(5)
    metric_columns[0].metric("Master records", result["source_count"] if result else 0)
    metric_columns[1].metric("Golden records", len(result["final"]) if result else 0)
    metric_columns[2].metric("Duplicate pairs", "—")
    metric_columns[3].metric("Pending reviews", "—")
    metric_columns[4].metric("Data quality", "—")

    sources_column, activity_column = st.columns([1.55, 1])
    with sources_column:
        st.subheader("Customer Sources Overview")
        selected_sources = st.session_state.get("last_sources", [])
        if selected_sources:
            source_rows = [{"Source table": name, "Scope": st.session_state.get("last_scope", ""), "Status": "Included in latest run"} for name in selected_sources]
            st.dataframe(pd.DataFrame(source_rows), use_container_width=True, hide_index=True)
        elif st.session_state.get("connected"):
            st.info("Connected. Select source tables in Connection & Ingestion to start a run.")
        else:
            st.info("Connect to Databricks and select source tables to populate this overview.")
        st.button(
            "Open Connection & Ingestion",
            key="overview_connection",
            on_click=_set_dashboard_view,
            args=("Connection & Ingestion",),
        )
    with activity_column:
        st.subheader("Pipeline Activity")
        if latest:
            status_class = "run-success" if latest["status"] == "SUCCESS" else "run-failed"
            st.markdown(f"**Latest run** &nbsp; <span class='{status_class}'>{latest['status']}</span>", unsafe_allow_html=True)
            st.caption(f"{latest['run_id']} · {latest['executed_at']}")
            st.write(f"{latest['rows_ingested']} rows ingested · {latest['golden_created']} golden records · {latest['duration_seconds']}s")
        else:
            st.info("No pipeline runs yet.")
        st.button(
            "View Pipeline Runs",
            key="overview_runs",
            on_click=_set_dashboard_view,
            args=("Pipeline Runs",),
        )

    if result:
        st.subheader("Latest Golden Records")
        frame = result["final"]
        if search_text:
            text_columns = frame.select_dtypes(include=["object", "string"]).columns
            matches = frame[text_columns].fillna("").astype(str).apply(
                lambda column: column.str.contains(search_text, case=False, regex=False)
            ).any(axis=1)
            frame = frame[matches]
        st.dataframe(frame, use_container_width=True, hide_index=True)
        st.download_button(
            "Download golden records CSV",
            frame.to_csv(index=False).encode("utf-8"),
            file_name="mdm_golden_records.csv",
            mime="text/csv",
        )

elif dashboard_view == "Pipeline Runs":
    st.subheader("MDM Pipeline Execution History")
    st.caption("Local run history for this browser session.")
    st.button(
        "Run New Pipeline",
        type="primary",
        disabled=not st.session_state.get("connected"),
        on_click=_set_dashboard_view,
        args=("Connection & Ingestion",),
    )
    history = st.session_state.get("pipeline_runs", [])
    if history:
        display_rows = [
            {
                "Run ID": run["run_id"],
                "Pipeline": run["pipeline"],
                "Domain": run["domain"],
                "Executed": run["executed_at"],
                "Status": run["status"],
                "Rows ingested": run["rows_ingested"],
                "Golden created": run["golden_created"],
                "Duration (s)": run["duration_seconds"],
            }
            for run in history
        ]
        st.dataframe(pd.DataFrame(display_rows), use_container_width=True, hide_index=True)
        failures = [run for run in history if run["error"]]
        if failures:
            with st.expander("Failed run details"):
                for run in failures:
                    st.markdown(f"**{run['run_id']}**")
                    st.code(run["error"])
    else:
        st.info("No runs have been recorded in this session yet.")