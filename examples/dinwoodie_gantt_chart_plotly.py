#!/usr/bin/env python3
"""
DINWOODIE Simulation Gantt Chart Generator (Plotly)

This script runs the DINWOODIE simulation and creates interactive Gantt charts
using Plotly Express, showing maintenance and repair requests over time.

Outputs are saved as HTML files in `examples/results/`.
"""

from __future__ import annotations

import argparse
from datetime import timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import plotly.express as px

from wombat import Simulation
from wombat.core.library import DINWOODIE
from wombat.core.library import load_yaml
from wombat.core.data_classes import EquipmentClass


def run_dinwoodie_simulation(config_name: str = "base", sim_years: Optional[int] = 1) -> Simulation:
    """Run the DINWOODIE simulation with the specified configuration.

    Parameters
    ----------
    config_name : str
        Name of the configuration file (without .yaml extension)
    sim_years : Optional[int]
        Number of years to run the simulation for. If None, uses config default.

    Returns
    -------
    Simulation
        The completed simulation object
    """
    print(f"Running DINWOODIE simulation with config: {config_name}")

    config_dict = load_yaml(DINWOODIE, f"project/config/{config_name}.yaml")

    if sim_years is not None:
        start_year = config_dict["start_year"]
        end_year = config_dict["end_year"]
        max_years = end_year - start_year
        if sim_years > max_years:
            print(
                f"The requested number of simulation years, {sim_years}, is greater than the maximum, {max_years} years"
            )
            print(f"Provide more weather data. Defaulting to {max_years} years")
            sim_years = max_years
        config_dict["end_year"] = start_year + sim_years

    simulation = Simulation(DINWOODIE, config_dict, random_seed=2023)
    simulation.run()

    print(f"Simulation completed: {simulation.config.name}")
    return simulation


def extract_maintenance_requests(simulation: Simulation) -> pd.DataFrame:
    """Extract maintenance and repair request events from the simulation results.

    Parameters
    ----------
    simulation : Simulation
        The completed simulation object

    Returns
    -------
    pd.DataFrame
        DataFrame with request events and useful derived columns
    """
    events = simulation.metrics.events

    maintenance_events = events[events["action"].isin(["maintenance request", "repair request"])].copy()
    if maintenance_events.empty:
        return maintenance_events

    maintenance_events["datetime"] = pd.to_datetime(maintenance_events["env_datetime"])  # start time
    maintenance_events["task_description"] = (
        maintenance_events["part_name"] + " - " + maintenance_events["reason"]
    )
    maintenance_events["request_type"] = maintenance_events["action"].str.replace(" request", "", regex=False)

    return maintenance_events


def ensure_results_directory(output_path: Path) -> None:
    results_dir = output_path.parent
    results_dir.mkdir(parents=True, exist_ok=True)


def create_gantt_chart_plotly(
    maintenance_data: pd.DataFrame,
    simulation: Simulation,
    output_file: str = "examples/results/dinwoodie_maintenance_gantt.html",
) -> None:
    """Create an interactive chart showing ONLY CTV work overlays per request.

    This chart omits the request markers and displays the time spent by Crew
    Transfer Vessels (CTVs) on each request, colored by vessel.
    """
    if maintenance_data.empty:
        print("No maintenance requests found in simulation data.")
        return

    output_path = Path(output_file)
    ensure_results_directory(output_path)

    # Build labels per request
    timeline_df = maintenance_data.copy().reset_index(drop=True)
    timeline_df["row_label"] = (
        (timeline_df.index + 1).astype(str) + ". " + timeline_df["task_description"].astype(str)
    )
    category_orders = {"row_label": timeline_df.sort_values("datetime")["row_label"].tolist()}

    # Derive CTV work segments from events
    events = simulation.metrics.events
    seg = events[
        (events["action"].isin(["maintenance", "repair"]))
        & (events["duration"].astype(float) > 0)
    ].copy()
    if seg.empty:
        print("No vessel work segments found in events.")
        return

    # Identify CTVs via simulation service equipment capabilities
    ctv_names = set()
    try:
        for equipment in simulation.service_equipment.values():  # type: ignore[attr-defined]
            caps = getattr(equipment.settings, "capability", [])
            # Normalize capability to iterable of EquipmentClass
            if isinstance(caps, (list, tuple, set)):
                is_ctv = any(cap == EquipmentClass.CTV for cap in caps)
            else:
                is_ctv = caps == EquipmentClass.CTV or str(caps).upper() == "CTV"
            if is_ctv:
                ctv_names.add(getattr(equipment.settings, "name", getattr(equipment, "name", "")))
    except Exception:
        # Fallback: use metrics service_equipment_names if available and filter later
        pass

    if ctv_names:
        seg = seg[seg["agent"].isin(ctv_names)].copy()
    else:
        # As a fallback, filter by known CTV-like substrings in agent name
        seg = seg.assign(agent=seg["agent"].astype(str))
        seg = seg[seg["agent"].str.contains(r"\bCTV\b|crew transfer", case=False, na=False)].copy()

    if seg.empty:
        print("No CTV segments found in events (check service equipment capabilities and names).")
        return

    # Map to requests present in maintenance_data
    req_to_row = dict(zip(maintenance_data["request_id"].astype(str), timeline_df["row_label"]))
    seg["request_id"] = seg["request_id"].astype(str)
    seg["row_label"] = seg["request_id"].map(req_to_row)
    seg = seg.dropna(subset=["row_label"])  # keep only segments tied to shown requests
    if seg.empty:
        print("No CTV segments matched the displayed requests.")
        return

    seg["start"] = pd.to_datetime(seg["env_datetime"])
    seg["finish"] = seg["start"] + pd.to_timedelta(seg["duration"].astype(float), unit="h")
    seg = seg.rename(columns={"agent": "vessel"})

    # Map vessel name -> vessel type (capability label)
    name_to_type: dict[str, str] = {}
    try:
        for equipment in simulation.service_equipment.values():  # type: ignore[attr-defined]
            name = getattr(equipment.settings, "name", getattr(equipment, "name", ""))
            caps = getattr(equipment.settings, "capability", [])
            if isinstance(caps, (list, tuple, set)):
                cap_labels = [c.value if hasattr(c, "value") else str(c).upper() for c in caps]
                cap_label = "+".join(sorted(set(cap_labels)))
            else:
                cap_label = caps.value if hasattr(caps, "value") else str(caps).upper()
            if name:
                name_to_type[str(name)] = cap_label
    except Exception:
        pass
    seg["vessel_type"] = seg["vessel"].map(name_to_type).fillna("CTV")

    # Use vessel on y-axis; color also distinguishes vessels
    vessel_orders = sorted(seg["vessel"].unique().tolist())
    fig = px.timeline(
        seg,
        x_start="start",
        x_end="finish",
        y="vessel",
        color="vessel",
        hover_data={
            "vessel": True,
            "action": True,
            "duration": ":.2f",
            "system_id": True,
            "request_id": True,
            "part_name": True,
        },
        category_orders={"vessel": vessel_orders},
        title="DINWOODIE CTV Work Timeline by Vessel",
        template="plotly_white",
    )

    fig.update_yaxes(title="")
    fig.update_xaxes(title="Time")

    # Dynamic height: scale by number of vessels
    n_vessels = max(1, len(vessel_orders))
    height = max(400, 60 * n_vessels)
    fig.update_layout(height=height, legend_title_text="Vessel")

    # Save PNG via Kaleido
    try:
        png_path = output_path.with_suffix(".png")
        fig.write_image(str(png_path), scale=2, engine="kaleido")
        print(f"PNG saved as: {png_path}")
    except Exception as exc:  # noqa: BLE001
        print(
            f"PNG export failed (kaleido): {exc}. Install kaleido: `pip install -U kaleido`"
        )

    fig.write_html(str(output_path), include_plotlyjs="cdn", full_html=True)
    print(f"Gantt chart saved as: {output_path}")


def create_detailed_gantt_chart_plotly(
    maintenance_data: pd.DataFrame,
    simulation: Simulation,
    output_file: str = "examples/results/dinwoodie_detailed_gantt.html",
) -> None:
    """Create an interactive Gantt chart with request-to-completion durations."""
    if maintenance_data.empty:
        print("No maintenance requests found in simulation data.")
        return

    output_path = Path(output_file)
    ensure_results_directory(output_path)

    events = simulation.metrics.events
    completion_events = events[events["action"].isin(["maintenance complete", "repair complete"])].copy()

    request_data = maintenance_data[[
        "request_id",
        "datetime",
        "task_description",
        "request_type",
        "part_name",
    ]].copy()
    request_data = request_data.rename(columns={"datetime": "request_time"})

    completion_data = completion_events[["request_id", "env_datetime", "agent"]].copy()
    completion_data["completion_time"] = pd.to_datetime(completion_data["env_datetime"])

    detailed_df = request_data.merge(
        completion_data[["request_id", "completion_time", "agent"]],
        on="request_id",
        how="left",
    )
    completed_df = detailed_df.dropna(subset=["completion_time"]).copy()

    if completed_df.empty:
        print("No completed maintenance tasks found.")
        return

    completed_df["duration"] = completed_df["completion_time"] - completed_df["request_time"]
    completed_df["duration_days"] = completed_df["duration"].dt.total_seconds() / (24 * 3600)
    completed_df = completed_df.rename(columns={"agent": "vessel"})

    # Choose a compact y label
    completed_df = completed_df.reset_index(drop=True)
    completed_df["row_label"] = (
        (completed_df.index + 1).astype(str)
        + ". "
        + completed_df["task_description"].astype(str)
    )

    color_map = {"maintenance": "#2E86AB", "repair": "#A23B72"}

    # Order tasks by request time
    category_orders = {"row_label": completed_df.sort_values("request_time")["row_label"].tolist()}

    fig = px.timeline(
        completed_df,
        x_start="request_time",
        x_end="completion_time",
        y="row_label",
        color="request_type",
        color_discrete_map=color_map,
        hover_data={
            "row_label": False,
            "task_description": True,
            "part_name": True,
            "request_time": True,
            "completion_time": True,
            "duration_days": ":.1f",
            "request_type": True,
            "vessel": True,
        },
        category_orders=category_orders,
        title="DINWOODIE Wind Farm Maintenance Task Durations",
        template="plotly_white",
    )

    fig.update_yaxes(title="")
    fig.update_xaxes(title="Time")

    height = max(500, 28 * len(completed_df))
    fig.update_layout(height=height, legend_title_text="Task Type")

    # Save PNG via Kaleido
    try:
        png_path = output_path.with_suffix(".png")
        fig.write_image(str(png_path), scale=2, engine="kaleido")
        print(f"PNG saved as: {png_path}")
    except Exception as exc:  # noqa: BLE001
        print(
            f"PNG export failed (kaleido): {exc}. Install kaleido: `pip install -U kaleido`"
        )

    fig.write_html(str(output_path), include_plotlyjs="cdn", full_html=True)
    print(f"Detailed Gantt chart saved as: {output_path}")


def print_summary_statistics(maintenance_data: pd.DataFrame) -> None:
    if maintenance_data.empty:
        print("No maintenance requests found.")
        return

    print("\n" + "=" * 60)
    print("MAINTENANCE REQUEST SUMMARY")
    print("=" * 60)

    total_requests = len(maintenance_data)
    print(f"Total maintenance requests: {total_requests}")

    request_types = maintenance_data["request_type"].value_counts()
    print("\nRequests by type:")
    for request_type, count in request_types.items():
        print(f"  {request_type.capitalize()}: {count}")

    component_requests = maintenance_data["part_name"].value_counts()
    print("\nRequests by component:")
    for component, count in component_requests.head(10).items():
        print(f"  {component}: {count}")

    start_time = maintenance_data["datetime"].min()
    end_time = maintenance_data["datetime"].max()
    print(f"\nSimulation time range: {start_time.strftime('%Y-%m-%d')} to {end_time.strftime('%Y-%m-%d')}")

    monthly_requests = maintenance_data.groupby(maintenance_data["datetime"].dt.to_period("M")).size()
    print(f"\nAverage requests per month: {monthly_requests.mean():.1f}")
    print(f"Peak month: {monthly_requests.idxmax()} with {monthly_requests.max()} requests")


def main() -> None:
    parser = argparse.ArgumentParser(description="DINWOODIE Plotly Gantt Chart Generator")
    parser.add_argument("--config", default="base", help="Configuration name (without .yaml)")
    parser.add_argument("--years", type=int, default=1, help="Number of simulation years to run")
    parser.add_argument(
        "--outdir",
        default="examples/results",
        help="Directory to write HTML outputs",
    )
    args = parser.parse_args()

    print("DINWOODIE Maintenance Gantt Chart Generator (Plotly)")
    print("=" * 50)

    try:
        simulation = run_dinwoodie_simulation(args.config, sim_years=args.years)
    except Exception as exc:
        print(f"Error running simulation: {exc}")
        raise

    maintenance_data = extract_maintenance_requests(simulation)
    print_summary_statistics(maintenance_data)

    if not maintenance_data.empty:
        outdir = Path(args.outdir)
        ensure_results_directory(outdir / "dummy.txt")  # ensure directory exists

        create_gantt_chart_plotly(
            maintenance_data,
            simulation,
            output_file=str(outdir / "dinwoodie_maintenance_gantt.html"),
        )
        create_detailed_gantt_chart_plotly(
            maintenance_data,
            simulation,
            output_file=str(outdir / "dinwoodie_detailed_gantt.html"),
        )
    else:
        print("No maintenance requests found in the simulation data.")


if __name__ == "__main__":
    main()


