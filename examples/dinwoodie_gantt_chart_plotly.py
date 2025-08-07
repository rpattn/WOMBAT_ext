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
    output_file: str = "examples/results/dinwoodie_maintenance_gantt.html",
) -> None:
    """Create an interactive Gantt chart of maintenance/repair requests.

    Each request is rendered as a short bar (1 hour) at the request time.
    """
    if maintenance_data.empty:
        print("No maintenance requests found in simulation data.")
        return

    output_path = Path(output_file)
    ensure_results_directory(output_path)

    timeline_df = maintenance_data.copy()
    # Ensure a vessel column exists (may contain Unassigned if not completed yet)
    if "vessel" not in timeline_df.columns:
        timeline_df["vessel"] = "Unassigned"
    timeline_df["start"] = timeline_df["datetime"]
    timeline_df["finish"] = timeline_df["datetime"] + pd.to_timedelta(1, unit="h")

    # Create a compact label for the y-axis
    timeline_df = timeline_df.reset_index(drop=True)
    timeline_df["row_label"] = (
        (timeline_df.index + 1).astype(str) + ". " + timeline_df["task_description"].astype(str)
    )

    color_map = {"maintenance": "#2E86AB", "repair": "#A23B72"}

    # Order tasks by time
    category_orders = {"row_label": timeline_df.sort_values("start")["row_label"].tolist()}

    fig = px.timeline(
        timeline_df,
        x_start="start",
        x_end="finish",
        y="row_label",
        color="request_type",
        color_discrete_map=color_map,
        hover_data={
            "row_label": False,
            "task_description": True,
            "part_name": True,
            "reason": True,
            "datetime": True,
            "request_type": True,
            "vessel": True,
        },
        category_orders=category_orders,
        title="DINWOODIE Wind Farm Maintenance Requests Timeline (All Requests)",
        template="plotly_white",
    )

    fig.update_yaxes(title="")
    fig.update_xaxes(title="Time")

    # Dynamic height: 28 px per row, min 500px
    height = max(500, 28 * len(timeline_df))
    fig.update_layout(height=height, legend_title_text="Request Type")

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
    fig.update_layout(height=height, legend_title_text="Task Type / Vessel")

    # Overlay vessel work segments (time actually spent by each vessel)
    # Extract segments from events where action is maintenance/repair with duration
    events = simulation.metrics.events
    vessel_segments = events[
        (events["action"].isin(["maintenance", "repair"]))
        & (events["request_id"].isin(completed_df["request_id"]))
        & (events["duration"].astype(float) > 0)
    ].copy()

    if not vessel_segments.empty:
        vessel_segments["start"] = pd.to_datetime(vessel_segments["env_datetime"])
        vessel_segments["finish"] = vessel_segments["start"] + pd.to_timedelta(
            vessel_segments["duration"].astype(float), unit="h"
        )
        # Map to request rows
        request_to_row = dict(
            zip(completed_df["request_id"].astype(str), completed_df["row_label"])
        )
        vessel_segments["request_id"] = vessel_segments["request_id"].astype(str)
        vessel_segments["row_label"] = vessel_segments["request_id"].map(request_to_row)
        vessel_segments = vessel_segments.dropna(subset=["row_label"]).copy()
        vessel_segments = vessel_segments.rename(columns={"agent": "vessel"})

        # Build a vessel color palette
        vessels = pd.unique(vessel_segments["vessel"].astype(str))
        palette = (
            px.colors.qualitative.Set2
            + px.colors.qualitative.Plotly
            + px.colors.qualitative.Safe
            + px.colors.qualitative.D3
        )
        vessel_color_map = {v: palette[i % len(palette)] for i, v in enumerate(vessels)}

        seg_fig = px.timeline(
            vessel_segments,
            x_start="start",
            x_end="finish",
            y="row_label",
            color="vessel",
            color_discrete_map=vessel_color_map,
            hover_data={
                "vessel": True,
                "action": True,
                "duration": ":.2f",
                "part_name": True,
                "request_id": True,
            },
            category_orders=category_orders,
        )

        # Make vessel segments semi-transparent and group legend entries
        for t in seg_fig.data:
            t.update(opacity=0.35, legendgroup="vessel", showlegend=True, name=f"Vessel: {t.name}")
        fig.add_traces(list(seg_fig.data))

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


