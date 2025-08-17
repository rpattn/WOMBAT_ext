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

from typing import Any, get_origin, get_args, get_type_hints
import enum
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
        # Build subschemas for each argument
        subs = [_json_type_from_annotation(a) for a in args]
        # Try to collapse to simple multi-type when all subs are simple {"type": <primitive>}
        simple_types: list[str] = []
        complex = False
        for s in subs:
            if isinstance(s, dict) and "type" in s and all(k in ("type", "format") for k in s.keys()):
                ty = s.get("type")
                if isinstance(ty, str):
                    simple_types.append(ty)
                elif isinstance(ty, list):
                    # already a multi-type; extend
                    for ty_i in ty:
                        if isinstance(ty_i, str):
                            simple_types.append(ty_i)
                        else:
                            complex = True
                            break
                else:
                    complex = True
            else:
                complex = True
            if complex:
                break
        if not complex and simple_types:
            # Deduplicate while preserving order
            seen: set[str] = set()
            dedup: list[str] = []
            for ty in simple_types:
                if ty not in seen:
                    seen.add(ty)
                    dedup.append(ty)
            return {"type": dedup if len(dedup) > 1 else dedup[0]}
        # Fallback to oneOf for complex combinations
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
    # datetime
    try:
        import datetime as _dt  # noqa
        if t is _dt.datetime:
            return {"type": "string", "format": "date-time"}
    except Exception:
        pass
    # paths, pathlib.Path, pandas.DataFrame etc → string as a path or ref; we keep string
    try:
        import pathlib  # noqa
        if t is pathlib.Path:
            return {"type": "string", "format": "path"}
    except Exception:
        pass

    # attrs class -> inline object schema
    try:
        if hasattr(t, "__attrs_attrs__"):
            sch = _inline_schema_for_attrs_class(t)
            if sch:
                return sch
    except Exception:
        pass

    # Python Enum / StrEnum -> string enum of values
    try:
        if inspect.isclass(t) and issubclass(t, enum.Enum):
            values = [e.value for e in t]  # StrEnum yields strings
            return {"type": "string", "enum": values}
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


def _inline_schema_for_attrs_class(cls: Any) -> dict[str, Any] | None:
    """Return a compact object schema for an attrs class for inline use.

    Keeps only type/object structure, properties, required, and additionalProperties.
    Drops $schema and title.
    """
    if not hasattr(cls, "__attrs_attrs__"):
        return None
    try:
        full = build_schema_for_attrs_class(cls)
    except Exception:
        return None
    props = full.get("properties") or {}
    req = full.get("required")
    inline: dict[str, Any] = {
        "type": "object",
        "properties": props,
        "additionalProperties": full.get("additionalProperties", False),
    }
    if req:
        inline["required"] = req
    return inline


def _extract_enum_from_validator(validator: Any) -> list[Any] | None:
    """Attempt to extract enum options from attrs validators.

    Handles:
    - validators.in_(options) -> has an 'options' attribute
    - validators.optional(inner)
    - validators.and_(...)
    """
    if validator is None:
        return None
    # Direct in_ validator (duck-typing by presence of 'options')
    opts = getattr(validator, "options", None)
    if opts is not None:
        try:
            return list(opts)
        except Exception:
            return None
    # Optional validator wraps a single inner validator
    inner = getattr(validator, "validator", None)
    if inner is not None and inner is not validator:
        got = _extract_enum_from_validator(inner)
        if got:
            return got
    # AndValidator: aggregate of multiple validators (attr names vary by version)
    many = getattr(validator, "validators", None) or getattr(validator, "_validators", None)
    if many and isinstance(many, (list, tuple)):
        for v in many:
            got = _extract_enum_from_validator(v)
            if got:
                return got
    return None


def build_schema_for_attrs_class(cls: Any, *, title: str | None = None) -> dict[str, Any]:
    """Generate a JSON Schema for an attrs-decorated class."""
    if not hasattr(cls, "__attrs_attrs__"):
        raise TypeError(f"Class {cls} is not an attrs class")

    field_descs = _parse_param_descriptions(getattr(cls, "__doc__", None))

    properties: dict[str, Any] = {}
    required: list[str] = []
    # Resolve annotations to concrete types (handles from __future__ annotations)
    try:
        resolved_hints = get_type_hints(cls)
    except Exception:
        resolved_hints = {}

    for a in attrs.fields(cls):
        name = a.name
        ann = resolved_hints.get(name, a.type)
        sch = _json_type_from_annotation(ann) if ann is not None else {"type": "string"}
        # enum from validators.in_(...)
        enum_vals = _extract_enum_from_validator(getattr(a, "validator", None))
        if enum_vals:
            try:
                # JSON-serializable enum values only
                sch["enum"] = list(enum_vals)
            except Exception:
                pass
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
    base = build_schema_for_attrs_class(Configuration, title="SimulationConfiguration")
    # Specialize service_equipment to reflect accepted forms used by Simulation:
    # - a single string (filename/id)
    # - an array of items where each item is either a string or a pair
    #   [count, name] or [name, count]
    se_desc = None
    try:
        se_desc = base["properties"].get("service_equipment", {}).get("description")
    except Exception:
        se_desc = None

    pair_int_str = {
        "type": "array",
        "prefixItems": [{"type": "integer"}, {"type": "string"}],
        "minItems": 2,
        "maxItems": 2,
    }
    pair_str_int = {
        "type": "array",
        "prefixItems": [{"type": "string"}, {"type": "integer"}],
        "minItems": 2,
        "maxItems": 2,
    }
    item_schema = {"oneOf": [{"type": "string"}, pair_int_str, pair_str_int]}

    base["properties"]["service_equipment"] = {
        "oneOf": [
            {"type": "string"},
            {"type": "array", "items": item_schema},
        ]
    }
    if se_desc:
        base["properties"]["service_equipment"]["description"] = se_desc
    return base


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
