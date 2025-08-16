"""Shared request/response models for FastAPI endpoints.

Centralize common Pydantic models used across routers to avoid duplication.
"""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel


class AddOrReplacePayload(BaseModel):
    file_path: str
    content: Any | None = None


class SaveLibraryPayload(BaseModel):
    project_name: str


class LoadSavedPayload(BaseModel):
    name: str
