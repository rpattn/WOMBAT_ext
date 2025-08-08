"""run with: fastapi dev examples/api/websocket_fastapi_demo.py"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

app = FastAPI(title="WOMBAT WebSocket Demo")

# Allow Vite dev server origins for browser-based WebSocket handshakes
if CORSMiddleware is not None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/")
async def health() -> dict[str, str]:
    return {"status": "ok"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    print("HERE")
    await websocket.accept()
    await websocket.send_text("Connected. Send a message and I'll echo it.")
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        # Client disconnected; simply return to end the handler
        return

