from __future__ import annotations

from pathlib import Path
from typing import Optional

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


