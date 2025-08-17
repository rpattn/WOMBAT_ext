from __future__ import annotations

"""
Lightweight JSON Schema generator for WOMBAT's attrs-based models.

Currently supports:
- Configuration (wombat.core.simulation_api.Configuration)
- ServiceEquipmentData variants (ScheduledServiceEquipmentData, UnscheduledServiceEquipmentData)

Notes:
- This introspects attrs classes to derive required fields, basic types, defaults.
- It attempts to parse docstrings' Parameters section for field descriptions when available.
- It intentionally keeps constraints minimal; can be extended to read validators and enums.
"""

from typing import Any, get_origin, get_args
import inspect
import sys

try:
    import attrs
except ImportError:  # pragma: no cover
    import attr as attrs  # type: ignore


def _json_type_from_annotation(ann: Any) -> Any:
    """Map Python/typing annotations to JSON Schema types.
    Falls back to 'string' when unknown.
    """
    origin = get_origin(ann)
    args = get_args(ann)

    # Handle Optionals / Unions
    if origin is None:
        t = ann
    else:
        t = origin

    # NoneType
    if ann is type(None):  # noqa: E721
        return {"type": "null"}

    # Union / Optional
    if t is sys.modules.get('typing').Union or t is getattr(sys, 'UnionType', None):  # type: ignore
        # Build oneOf for each argument
        subs = [_json_type_from_annotation(a) for a in args]
        # Merge simple type arrays if possible
        return {"oneOf": subs}

    # Containers
    if t in (list, tuple, set):
        item_ann = args[0] if args else Any
        return {"type": "array", "items": _json_type_from_annotation(item_ann)}
    if t in (dict,):
        return {"type": "object"}

    # Simple builtins and common types
    if t in (int,):
        return {"type": "integer"}
    if t in (float,):
        return {"type": "number"}
    if t in (bool,):
        return {"type": "boolean"}
    # paths, pathlib.Path, pandas.DataFrame etc → string as a path or ref; we keep string
    try:
        import pathlib  # noqa
        if t is pathlib.Path:
            return {"type": "string", "format": "path"}
    except Exception:
        pass

    # Fallback
    return {"type": "string"}


def _parse_param_descriptions(doc: str | None) -> dict[str, str]:
    """Very simple parser to map field names to descriptions from a Numpy-style docstring.

    Looks for a 'Parameters' section and captures lines "name : type" followed by indented description lines.
    """
    if not doc:
        return {}
    lines = doc.splitlines()
    # Find Parameters header
    try:
        start = next(i for i, l in enumerate(lines) if l.strip().lower().startswith('parameters'))
    except StopIteration:
        return {}

    # Collect from start+1 until a blank line followed by a non-indented or until another section
    descs: dict[str, str] = {}
    i = start + 1
    current: str | None = None
    buf: list[str] = []
    while i < len(lines):
        line = lines[i]
        if line.strip() == '':
            # flush current paragraph if any
            if current and buf:
                descs[current] = ' '.join([b.strip() for b in buf]).strip()
                current, buf = None, []
            i += 1
            continue
        if not line.startswith(' '):
            # Reached next section
            if current and buf:
                descs[current] = ' '.join([b.strip() for b in buf]).strip()
            break
        # Parameter header line e.g., "name : type"
        if ':' in line and (line.lstrip() == line or line.startswith('    ')):
            # new param
            if current and buf:
                descs[current] = ' '.join([b.strip() for b in buf]).strip()
            left = line.strip().split(':', 1)[0]
            current = left.split(',')[0].strip()
            buf = []
        else:
            if current is not None:
                buf.append(line)
        i += 1
    # final flush
    if current and buf and current not in descs:
        descs[current] = ' '.join([b.strip() for b in buf]).strip()
    return descs


def build_schema_for_attrs_class(cls: Any, *, title: str | None = None) -> dict[str, Any]:
    """Generate a JSON Schema for an attrs-decorated class."""
    if not hasattr(cls, "__attrs_attrs__"):
        raise TypeError(f"Class {cls} is not an attrs class")

    field_descs = _parse_param_descriptions(getattr(cls, "__doc__", None))

    properties: dict[str, Any] = {}
    required: list[str] = []

    for a in attrs.fields(cls):
        name = a.name
        sch = _json_type_from_annotation(a.type) if a.type is not None else {"type": "string"}
        # default
        default_val = None
        NOTHING = getattr(attrs, "NOTHING", object())
        has_default = a.default is not NOTHING
        # Avoid Factory defaults and callables
        if has_default and not callable(a.default) and not hasattr(a.default, "factory"):
            try:
                default_val = a.default  # type: ignore
            except Exception:
                default_val = None
        if default_val is not None and isinstance(default_val, (int, float, str, bool)):
            sch["default"] = default_val
        # description
        if name in field_descs:
            sch["description"] = field_descs[name]
        properties[name] = sch
        # required if init and no default
        if a.init and not has_default:
            required.append(name)

    schema: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "title": title or cls.__name__,
        "properties": properties,
        "additionalProperties": False,
    }
    if required:
        schema["required"] = required
    return schema


# Convenience builders for known WOMBAT models

def schema_configuration() -> dict[str, Any]:
    from wombat.core.simulation_api import Configuration

    return build_schema_for_attrs_class(Configuration, title="SimulationConfiguration")


def schema_service_equipment_variants() -> dict[str, dict[str, Any]]:
    from wombat.core.data_classes import (
        ScheduledServiceEquipmentData,
        UnscheduledServiceEquipmentData,
    )

    scheduled = build_schema_for_attrs_class(
        ScheduledServiceEquipmentData, title="ServiceEquipmentScheduled"
    )
    unscheduled = build_schema_for_attrs_class(
        UnscheduledServiceEquipmentData, title="ServiceEquipmentUnscheduled"
    )
    combined = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "ServiceEquipment",
        "oneOf": [scheduled, unscheduled],
    }
    return {
        "scheduled": scheduled,
        "unscheduled": unscheduled,
        "combined": combined,
    }


def schema_by_name(name: str) -> dict[str, Any]:
    name = name.lower()
    if name in ("configuration", "config"):
        return schema_configuration()
    if name in ("service_equipment", "vessel", "vessels"):
        return schema_service_equipment_variants()["combined"]
    if name in ("service_equipment_scheduled", "vessel_scheduled"):
        return schema_service_equipment_variants()["scheduled"]
    if name in ("service_equipment_unscheduled", "vessel_unscheduled"):
        return schema_service_equipment_variants()["unscheduled"]
    raise KeyError(
        "Unknown schema name. Use one of: configuration, service_equipment, "
        "service_equipment_scheduled, service_equipment_unscheduled"
    )
