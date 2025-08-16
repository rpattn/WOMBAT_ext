"""Shared request/response models for FastAPI endpoints.

Centralize common Pydantic models used across routers to avoid duplication.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class AddOrReplacePayload(BaseModel):
    file_path: str
    content: Any | None = None


class SaveLibraryPayload(BaseModel):
    project_name: str


class LoadSavedPayload(BaseModel):
    name: str


# Response models
class OperationOkResponse(BaseModel):
    ok: bool
    message: Optional[str] = None
    files: Optional[dict] = None


class FileContentResponse(BaseModel):
    file: str
    data: Any


class RawFileContentResponse(BaseModel):
    file: str
    # Exactly one of data or data_b64 will be present
    data: Optional[str] = None
    data_b64: Optional[str] = None
    mime: str
    raw: bool = True


class FileListResponse(BaseModel):
    files: dict


class RefreshResponse(BaseModel):
    files: dict
    config: Any
    saved: list[str]


class SimulationResultResponse(BaseModel):
    status: str
    results: Any
    files: dict


class SimulationTriggerResponse(BaseModel):
    task_id: str
    status: str


class SimulationStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Any] = None
    files: Optional[dict] = None


class SavedListResponse(BaseModel):
    dirs: list[str]


class OkWithFilesAndMessageResponse(BaseModel):
    ok: bool
    message: Optional[str] = None
    files: Optional[dict] = None
