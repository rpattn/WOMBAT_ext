from __future__ import annotations

"""WOMBAT Simulation Server - Main FastAPI application."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from client_manager import client_manager
from message_handler import handle_message

app = FastAPI(title="WOMBAT Simulation Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for client connections."""
    await websocket.accept()
    
    # Generate unique client ID and register client
    client_id = client_manager.generate_client_id()
    client_manager.add_client(client_id, websocket)
    
    await websocket.send_text(
        f"Connected as client {client_id[:8]}. Send 'run' to start a WOMBAT simulation in temp library."
    )

    try:
        while True:
            data = await websocket.receive_text()
            
            # Handle all messages through the unified handler with client tracking
            handled = await handle_message(websocket, data, client_id)
            
            if not handled:
                await websocket.send_text(f"Echo: {data}")
                
    except WebSocketDisconnect:
        # Clean up client and any running simulations
        client_manager.remove_client(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
