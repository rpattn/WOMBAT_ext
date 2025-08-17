from __future__ import annotations

from fastapi import APIRouter, HTTPException

from wombat.utilities.schema_gen import (
    schema_by_name,
    schema_service_equipment_variants,
)

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.get("/")
async def list_schemas() -> dict[str, list[str]]:
    return {
        "available": [
            "configuration",
            "service_equipment",
            "service_equipment/variants",
            "service_equipment_scheduled",
            "service_equipment_unscheduled",
            "substation",
            "turbine",
            "equipment_turbine",
            "project_port",
        ]
    }


@router.get("/{name}")
async def get_schema(name: str) -> dict:
    try:
        return schema_by_name(name)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/service_equipment/variants")
async def get_service_equipment_variants() -> dict:
    """Return the individual and combined service equipment schemas."""
    try:
        return schema_service_equipment_variants()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
