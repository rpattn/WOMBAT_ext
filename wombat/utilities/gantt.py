from __future__ import annotations

from pathlib import Path
from typing import Optional, Iterable

import pandas as pd

from wombat import Simulation
from wombat.core.data_classes import EquipmentClass


def ensure_results_directory(output_path: Path) -> None:
    """Create the parent directory for the output path if needed."""
    output_path.parent.mkdir(parents=True, exist_ok=True)


def extract_maintenance_requests(simulation: Simulation) -> pd.DataFrame:
    """Extract maintenance and repair request events from simulation results.

    Returns a DataFrame with added columns:
    - datetime: parsed from env_datetime
    - task_description: part_name + reason
    - request_type: 'maintenance' or 'repair'
    """
    events = simulation.metrics.events
    maintenance_events = events[events["action"].isin(["maintenance request", "repair request"])].copy()
    if maintenance_events.empty:
        return maintenance_events

    maintenance_events["datetime"] = pd.to_datetime(maintenance_events["env_datetime"])  # start
    maintenance_events["task_description"] = (
        maintenance_events["part_name"] + " - " + maintenance_events["reason"]
    )
    maintenance_events["request_type"] = maintenance_events["action"].str.replace(
        " request", "", regex=False
    )
    return maintenance_events


def get_ctv_segments(simulation: Simulation, maintenance_data: pd.DataFrame) -> pd.DataFrame:
    """Return per-vessel work segments for CTVs tied to the provided requests.

    The returned DataFrame includes columns:
    - request_id, system_id, part_name
    - vessel (servicing equipment name)
    - start, finish (timestamps)
    - duration (hours)
    """
    events = simulation.metrics.events
    segments = events[
        (events["action"].isin(["maintenance", "repair"]))
        & (events["duration"].astype(float) > 0)
    ].copy()
    if segments.empty:
        return segments

    # Identify CTV vessels from simulation capabilities
    ctv_names: set[str] = set()
    try:
        for equipment in simulation.service_equipment.values():  # type: ignore[attr-defined]
            caps = getattr(equipment.settings, "capability", [])
            if isinstance(caps, (list, tuple, set)):
                is_ctv = any(cap == EquipmentClass.CTV for cap in caps)
            else:
                is_ctv = caps == EquipmentClass.CTV or str(caps).upper() == "CTV"
            if is_ctv:
                ctv_names.add(getattr(equipment.settings, "name", getattr(equipment, "name", "")))
    except Exception:
        # Fallback is handled below via name matching
        pass

    if ctv_names:
        segments = segments[segments["agent"].isin(ctv_names)].copy()
    else:
        # Fallback heuristic name filter
        segments = segments.assign(agent=segments["agent"].astype(str))
        segments = segments[segments["agent"].str.contains(r"\bCTV\b|crew transfer", case=False, na=False)].copy()

    if segments.empty:
        return segments

    # Restrict to provided requests
    req_ids = set(maintenance_data["request_id"].astype(str).tolist())
    segments["request_id"] = segments["request_id"].astype(str)
    segments = segments[segments["request_id"].isin(req_ids)].copy()
    if segments.empty:
        return segments

    segments["start"] = pd.to_datetime(segments["env_datetime"])
    segments["finish"] = segments["start"] + pd.to_timedelta(segments["duration"].astype(float), unit="h")
    segments = segments.rename(columns={"agent": "vessel"})

    # Keep only useful columns
    keep_cols = [
        "request_id",
        "system_id",
        "part_name",
        "vessel",
        "start",
        "finish",
        "duration",
    ]
    return segments[keep_cols]


def get_ctv_segments_filtered(
    simulation: Simulation,
    maintenance_data: pd.DataFrame,
    request_types: Optional[Iterable[str]] = None,
) -> pd.DataFrame:
    """Return CTV segments filtered to specific request types if provided.

    Parameters
    ----------
    simulation : Simulation
        The simulation object.
    maintenance_data : pd.DataFrame
        Maintenance requests DataFrame (from extract_maintenance_requests).
    request_types : Optional[Iterable[str]]
        If provided, only segments belonging to requests with these types are kept
        (e.g., {"repair"}).
    """
    segments = get_ctv_segments(simulation, maintenance_data)
    if segments.empty:
        return segments
    if request_types is None:
        return segments
    # Attach request_type and filter
    df = segments.merge(
        maintenance_data[["request_id", "request_type"]], on="request_id", how="left"
    )
    df = df[df["request_type"].isin(set(request_types))].copy()
    return df.drop(columns=["request_type"])  # keep schema similar


def get_vessel_type_map(simulation: Simulation) -> dict[str, str]:
    """Return mapping from vessel name to capability label (e.g., CTV).

    Falls back to empty mapping if unavailable.
    """
    mapping: dict[str, str] = {}
    try:
        for equipment in simulation.service_equipment.values():  # type: ignore[attr-defined]
            name = getattr(equipment.settings, "name", getattr(equipment, "name", ""))
            caps = getattr(equipment.settings, "capability", [])
            if isinstance(caps, (list, tuple, set)):
                cap_labels = [getattr(c, "value", str(c)).upper() for c in caps]
                cap_label = "+".join(sorted(set(cap_labels)))
            else:
                cap_label = getattr(caps, "value", str(caps)).upper()
            if name:
                mapping[str(name)] = cap_label
    except Exception:
        pass
    return mapping


def build_completed_tasks(
    simulation: Simulation,
    maintenance_data: pd.DataFrame,
    request_type_filter: Optional[str] = None,
) -> pd.DataFrame:
    """Build a DataFrame of completed tasks with durations and labels.

    Parameters
    ----------
    simulation : Simulation
        The simulation object.
    maintenance_data : pd.DataFrame
        Output from extract_maintenance_requests.
    request_type_filter : Optional[str]
        If provided (e.g., "repair"), only keep that request type.

    Returns
    -------
    pd.DataFrame
        Columns include: request_id, request_time, completion_time, task_description,
        request_type, part_name, system_id (if present in maintenance_data),
        duration (Timedelta), duration_hours, duration_days, row_label
    """
    events = simulation.metrics.events
    completion_events = events[events["action"].isin(["maintenance complete", "repair complete"])].copy()

    keep_cols = [
        "request_id",
        "datetime",
        "task_description",
        "request_type",
        "part_name",
    ]
    if "system_id" in maintenance_data.columns:
        keep_cols.append("system_id")
    request_data = maintenance_data[keep_cols].copy()
    request_data = request_data.rename(columns={"datetime": "request_time"})

    completion_data = completion_events[["request_id", "env_datetime"]].copy()
    completion_data["completion_time"] = pd.to_datetime(completion_data["env_datetime"])

    df = request_data.merge(
        completion_data[["request_id", "completion_time"]], on="request_id", how="left"
    )
    df = df.dropna(subset=["completion_time"]).copy()

    if request_type_filter is not None:
        df = df[df["request_type"] == request_type_filter].copy()

    if df.empty:
        return df

    df["duration"] = df["completion_time"] - df["request_time"]
    df["duration_hours"] = df["duration"].dt.total_seconds() / 3600.0
    df["duration_days"] = df["duration"].dt.total_seconds() / (24 * 3600)

    df = df.reset_index(drop=True)
    df["row_label"] = (df.index + 1).astype(str) + ". " + df["task_description"].astype(str)
    return df


def save_plotly_figure(fig, output_path: Path, png: bool = True) -> None:
    """Save a Plotly figure to HTML and PNG via Kaleido.

    HTML is always saved. PNG saving can be disabled.
    """
    if png:
        try:
            png_path = output_path.with_suffix(".png")
            fig.write_image(str(png_path), scale=2, engine="kaleido")
            print(f"PNG saved as: {png_path}")
        except Exception as exc:  # noqa: BLE001
            print(
                f"PNG export failed (kaleido): {exc}. Install kaleido: `pip install -U kaleido`"
            )
    fig.write_html(str(output_path), include_plotlyjs="cdn", full_html=True)
    print(f"HTML saved as: {output_path}")



