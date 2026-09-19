"""Conversational endpoint — the one the demo drives."""
from __future__ import annotations

from fastapi import APIRouter

from ..agents import planner
from ..schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Ask ORCA anything in English, Hindi or Marathi."""
    return planner.handle(req)


@router.post("/chat/reset")
def reset(session_id: str = "default") -> dict:
    planner.reset_session(session_id)
    return {"ok": True, "session_id": session_id}
