from __future__ import annotations

from fastapi import APIRouter, HTTPException

from wombat.utilities.schema_gen import schema_by_name, schema_service_equipment_variants, schema_configuration

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.get("/")
async def list_schemas() -> dict[str, list[str]]:
    return {
        "available": [
            "configuration",
            "service_equipment",
            "service_equipment_scheduled",
            "service_equipment_unscheduled",
            "project_port",
        ]
    }


@router.get("/{name}")
async def get_schema(name: str) -> dict:
    try:
        return schema_by_name(name)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
