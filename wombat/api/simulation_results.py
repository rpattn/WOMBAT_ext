import pandas as pd
from wombat import Simulation
from typing import Dict, Any
from pathlib import Path
import time
import plotly.express as px
from wombat.utilities.gantt import (
    ensure_results_directory,
    extract_maintenance_requests as util_extract_maintenance_requests,
    build_completed_tasks,
    save_plotly_figure,
)


def extract_maintenance_requests(sim: Simulation):
    """
    Extract maintenance request data from the simulation results.
    
    Parameters
    ----------
    sim : Simulation
        The completed simulation object
        
    Returns
    -------
    pd.DataFrame
        DataFrame containing maintenance request information
    """
    # Get events data
    events = sim.metrics.events
    
    # Filter for maintenance and repair requests
    maintenance_events = events[
        events['action'].isin(['maintenance request', 'repair request'])
    ].copy()
    
    # Convert simulation time to datetime
    maintenance_events['datetime'] = pd.to_datetime(
        maintenance_events['env_datetime']
    )
    
    # Create a more readable task description
    maintenance_events['task_description'] = (
        maintenance_events['part_name'] + ' - ' + 
        maintenance_events['reason']
    )
    
    # Add request type (maintenance vs repair)
    maintenance_events['request_type'] = maintenance_events['action'].str.replace(
        ' request', ''
    )
    
    return maintenance_events


# instead of printing return a dictionary of summary statistics
def maintenance_summary_statistics(maintenance_data: pd.DataFrame) -> Dict[str, Any]:
    """
    Return summary statistics about the maintenance requests.

    Parameters
    ----------
    maintenance_data : pd.DataFrame
        DataFrame containing maintenance request information

    Returns
    -------
    Dict[str, Any]
        Dictionary with summary statistics
    """
    if maintenance_data.empty:
        return {
            "total_requests": 0,
            "requests_by_type": {},
            "requests_by_component": {},
            "start_time": None,
            "end_time": None,
            "average_requests_per_month": 0.0,
            "peak_month": None,
            "peak_month_count": 0,
        }

    # Total requests
    total_requests = int(len(maintenance_data))

    # Requests by type
    request_types_series = maintenance_data["request_type"].value_counts()
    requests_by_type = {str(k): int(v) for k, v in request_types_series.items()}

    # Requests by component (top 10)
    component_requests_series = maintenance_data["part_name"].value_counts()
    requests_by_component = {
        str(k): int(v) for k, v in component_requests_series.head(10).items()
    }

    # Time range
    start_ts = maintenance_data["datetime"].min()
    end_ts = maintenance_data["datetime"].max()
    start_time = start_ts.isoformat() if hasattr(start_ts, "isoformat") else str(start_ts)
    end_time = end_ts.isoformat() if hasattr(end_ts, "isoformat") else str(end_ts)

    # Monthly distribution
    monthly_requests = (
        maintenance_data.groupby(maintenance_data["datetime"].dt.to_period("M")).size()
    )
    if len(monthly_requests) == 0:
        avg_per_month = 0.0
        peak_month = None
        peak_count = 0
    else:
        avg_per_month = float(monthly_requests.mean())
        peak_period = monthly_requests.idxmax()
        peak_month = str(peak_period)
        peak_count = int(monthly_requests.max())

    return {
        "total_requests": total_requests,
        "requests_by_type": requests_by_type,
        "requests_by_component": requests_by_component,
        "start_time": start_time,
        "end_time": end_time,
        "average_requests_per_month": avg_per_month,
        "peak_month": peak_month,
        "peak_month_count": peak_count,
    }

        
def power_production_summary_statistics(env) -> Dict[str, Any]:
    """
    Return summary statistics for power production using files written by the
    environment. Reads `env.power_production_fname` (and optionally
    `env.power_potential_fname`) and aggregates metrics.

    Parameters
    ----------
    env : wombat.core.environment.WombatEnvironment
        The simulation environment that provides file paths for production data.

    Returns
    -------
    Dict[str, Any]
        Dictionary with summary statistics for power production.
    """
    # Attempt to load production dataframe
    try:
        prod_df = pd.read_parquet(env.power_production_fname)
    except Exception:
        # Fallback: no data available
        return {
            "start_time": None,
            "end_time": None,
            "hours": 0,
            "windfarm_energy_mwh": 0.0,
            "avg_windfarm_power_mw": 0.0,
            "peak_windfarm_power_mw": 0.0,
            "capacity_factor": None,
            "monthly_energy_mwh": {},
            "per_component_energy_mwh": {},
        }

    if prod_df.empty:
        return {
            "start_time": None,
            "end_time": None,
            "hours": 0,
            "windfarm_energy_mwh": 0.0,
            "avg_windfarm_power_mw": 0.0,
            "peak_windfarm_power_mw": 0.0,
            "capacity_factor": None,
            "monthly_energy_mwh": {},
            "per_component_energy_mwh": {},
        }

    # Ensure datetime is datetime64
    if not pd.api.types.is_datetime64_any_dtype(prod_df.get("env_datetime", pd.Series([], dtype="datetime64[ns]"))):
        try:
            prod_df["env_datetime"] = pd.to_datetime(prod_df["env_datetime"])  # type: ignore[index]
        except Exception:
            pass

    # Core columns present in production parquet
    base_cols = {"env_time", "env_datetime", "windspeed", "windfarm"}
    component_cols = [c for c in prod_df.columns if c not in base_cols]

    # Time range and hours
    start_ts = prod_df["env_datetime"].min() if "env_datetime" in prod_df else None
    end_ts = prod_df["env_datetime"].max() if "env_datetime" in prod_df else None
    start_time = start_ts.isoformat() if hasattr(start_ts, "isoformat") else (str(start_ts) if start_ts is not None else None)
    end_time = end_ts.isoformat() if hasattr(end_ts, "isoformat") else (str(end_ts) if end_ts is not None else None)
    hours = int(len(prod_df))

    # Windfarm energy and power
    windfarm_series = prod_df.get("windfarm")
    if windfarm_series is None:
        windfarm_energy_mwh = 0.0
        avg_windfarm_power_mw = 0.0
        peak_windfarm_power_mw = 0.0
    else:
        # Hourly MW -> MWh by summing over hours
        windfarm_energy_mwh = float(windfarm_series.sum())
        avg_windfarm_power_mw = float(windfarm_series.mean())
        peak_windfarm_power_mw = float(windfarm_series.max())

    # Monthly distribution (sum of energy per month)
    if "env_datetime" in prod_df:
        monthly_energy = prod_df.groupby(prod_df["env_datetime"].dt.to_period("M"))["windfarm"].sum()
        monthly_energy_mwh = {str(k): float(v) for k, v in monthly_energy.items()}
    else:
        monthly_energy_mwh = {}

    # Per-component energy (sum across hours for each component column)
    per_component_energy_mwh = {str(col): float(prod_df[col].sum()) for col in component_cols}

    # Capacity factor = total production energy / total potential energy (if available)
    capacity_factor = None
    try:
        pot_df = pd.read_parquet(env.power_potential_fname)
        if not pot_df.empty and "windfarm" in pot_df and pot_df["windfarm"].sum() > 0:
            capacity_factor = float(windfarm_energy_mwh / pot_df["windfarm"].sum())
    except Exception:
        pass

    return {
        "start_time": start_time,
        "end_time": end_time,
        "hours": hours,
        "windfarm_energy_mwh": windfarm_energy_mwh,
        "avg_windfarm_power_mw": avg_windfarm_power_mw,
        "peak_windfarm_power_mw": peak_windfarm_power_mw,
        "capacity_factor": capacity_factor,
        "monthly_energy_mwh": monthly_energy_mwh,
        "per_component_energy_mwh": per_component_energy_mwh,
    }


def create_detailed_gantt_chart_plotly(sim: Simulation, project_dir: str | Path, filename: str | None = None) -> str:
    """
    Generate a detailed Plotly Gantt chart of maintenance task durations and
    save it to the project's results directory.

    Parameters
    ----------
    sim : Simulation
        Completed simulation instance.
    project_dir : str | Path
        Root of the project directory where results/ resides.
    filename : Optional[str]
        Custom output HTML filename. If omitted, uses a timestamped default
        like "YYYY-MM-DD_HH-MM_gantt_detailed.html".

    Returns
    -------
    str
        The path to the saved HTML file. Returns an empty string if no data.
    """
    project_dir_path = Path(project_dir)
    results_dir = project_dir_path / "results"

    # Default filename with timestamp if not provided
    if not filename:
        timestamp = time.strftime("%Y-%m-%d_%H-%M", time.localtime())
        filename = f"{timestamp}_gantt_detailed.html"

    output_path = results_dir / filename
    ensure_results_directory(output_path)

    # Extract maintenance requests and build completed tasks table
    maintenance_data = util_extract_maintenance_requests(sim)
    if maintenance_data is None or maintenance_data.empty:
        return ""

    completed_df = build_completed_tasks(sim, maintenance_data)
    if completed_df is None or completed_df.empty:
        return ""

    # Prepare data for plotting
    completed_df = completed_df.copy()
    color_map = {"maintenance": "#2E86AB", "repair": "#A23B72"}
    category_orders = {
        "row_label": completed_df.sort_values("request_time")["row_label"].tolist()
    }

    hover_fields: Dict[str, Any] = {
        "row_label": False,
        "task_description": True,
        "part_name": True,
        "request_time": True,
        "completion_time": True,
        "duration_days": ":.1f",
        "request_type": True,
    }
    if "vessel" in completed_df.columns:
        hover_fields["vessel"] = True

    fig = px.timeline(
        completed_df,
        x_start="request_time",
        x_end="completion_time",
        y="row_label",
        color="request_type",
        color_discrete_map=color_map,
        hover_data=hover_fields,
        category_orders=category_orders,
        title="Wind Farm Maintenance Task Durations",
        template="plotly_white",
    )

    fig.update_yaxes(title="")
    fig.update_xaxes(title="Time")

    height = max(500, 28 * len(completed_df))
    fig.update_layout(height=height, legend_title_text="Task Type")

    # Save HTML (and PNG if kaleido available)
    save_plotly_figure(fig, output_path)

    return str(output_path)
