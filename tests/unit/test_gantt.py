import pandas as pd
import pytest

from wombat.utilities.gantt import (
    extract_maintenance_requests,
    get_ctv_segments,
    get_ctv_segments_filtered,
    get_vessel_type_map,
    build_completed_tasks,
)


class DummySimulation:
    def __init__(self, events: pd.DataFrame, service_equipment: dict | None = None):
        class DummyMetrics:
            def __init__(self, df: pd.DataFrame):
                self.events = df

        self.metrics = DummyMetrics(events)
        # Minimal shape of Simulation.service_equipment used by utilities
        self.service_equipment = service_equipment or {}


class DummyEquipment:
    def __init__(self, name: str, capability):
        class Settings:
            def __init__(self, n: str, cap):
                self.name = n
                self.capability = cap

        self.settings = Settings(name, capability)


def test_extract_maintenance_requests_basic():
    df = pd.DataFrame(
        [
            {"action": "maintenance request", "env_datetime": "2020-01-01", "part_name": "X", "reason": "Y"},
            {"action": "repair request", "env_datetime": "2020-01-02", "part_name": "A", "reason": "B"},
            {"action": "maintenance", "env_datetime": "2020-01-03"},
        ]
    )
    sim = DummySimulation(events=df)
    out = extract_maintenance_requests(sim)
    assert len(out) == 2
    assert set(out["request_type"]) == {"maintenance", "repair"}
    assert "datetime" in out.columns
    assert "task_description" in out.columns


def _events_for_segments():
    # A simple pair of segments: one CTV maintenance, one non-CTV
    return pd.DataFrame(
        [
            {
                "action": "maintenance",
                "duration": 2.0,
                "env_datetime": "2020-01-05 00:00:00",
                "agent": "Crew Transfer Vessel",
                "request_id": "r1",
                "system_id": "T01",
                "part_name": "gearbox",
            },
            {
                "action": "repair",
                "duration": 3.0,
                "env_datetime": "2020-01-06 00:00:00",
                "agent": "Large Crane Vessel",
                "request_id": "r2",
                "system_id": "T02",
                "part_name": "blade",
            },
        ]
    )


def test_get_ctv_segments_filters_to_ctv():
    events = _events_for_segments()
    # service equipment marks only the CTV as CTV
    sim = DummySimulation(
        events=events,
        service_equipment={
            "CTV": DummyEquipment("Crew Transfer Vessel", capability=[type("Cap", (), {"value": "CTV"})()])
        },
    )
    maint = pd.DataFrame(
        [
            {"request_id": "r1"},
            {"request_id": "r2"},
        ]
    )
    seg = get_ctv_segments(sim, maint)
    assert set(seg["request_id"]) == {"r1"}
    assert {"vessel", "start", "finish", "duration"}.issubset(seg.columns)


def test_get_ctv_segments_filtered_repairs_only():
    events = _events_for_segments()
    sim = DummySimulation(
        events=events,
        service_equipment={
            "CTV": DummyEquipment("Crew Transfer Vessel", capability=[type("Cap", (), {"value": "CTV"})()])
        },
    )
    maint = pd.DataFrame(
        [
            {"request_id": "r1", "request_type": "maintenance"},
            {"request_id": "r2", "request_type": "repair"},
        ]
    )
    seg = get_ctv_segments_filtered(sim, maint, request_types={"repair"})
    # Only r1 is CTV but it's maintenance; filtered result should be empty
    assert seg.empty or set(seg["request_id"]) == set()


def test_build_completed_tasks_and_vessel_map():
    # Two requests, both complete; one repair
    maint = pd.DataFrame(
        [
            {
                "request_id": "r1",
                "datetime": "2020-01-01 00:00:00",
                "task_description": "task1",
                "request_type": "maintenance",
                "part_name": "X",
                "system_id": "T01",
            },
            {
                "request_id": "r2",
                "datetime": "2020-01-02 00:00:00",
                "task_description": "task2",
                "request_type": "repair",
                "part_name": "Y",
                "system_id": "T02",
            },
        ]
    )
    events = pd.DataFrame(
        [
            {"action": "maintenance complete", "request_id": "r1", "env_datetime": "2020-01-03 00:00:00"},
            {"action": "repair complete", "request_id": "r2", "env_datetime": "2020-01-04 12:00:00"},
        ]
    )
    sim = DummySimulation(events=events, service_equipment={})
    all_done = build_completed_tasks(sim, maint)
    assert set(["request_id", "request_time", "completion_time", "duration_hours"]).issubset(all_done.columns)
    repairs = build_completed_tasks(sim, maint, request_type_filter="repair")
    assert set(repairs["request_type"]) == {"repair"}

    # Vessel type map works with provided equipment
    sim2 = DummySimulation(events=events, service_equipment={
        "CTV": DummyEquipment("Crew Transfer Vessel", capability=[type("Cap", (), {"value": "CTV"})()])
    })
    name_map = get_vessel_type_map(sim2)
    assert name_map.get("Crew Transfer Vessel") == "CTV"


