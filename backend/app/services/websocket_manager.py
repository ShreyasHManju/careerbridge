import asyncio
import logging
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """
    In-memory connection manager for CareerBridge WebSocket connections.
    Tracks active connections mapped by conversation_id -> user_id -> set[WebSocket].
    Supports multiple concurrent connections per user (multi-tab/device support).
    """

    def __init__(self) -> None:
        # Internal mapping: {conversation_id: {user_id: set of WebSocket}}
        self._connections: Dict[int, Dict[int, Set[WebSocket]]] = {}

    async def connect(
        self, conversation_id: int, user_id: int, websocket: WebSocket
    ) -> None:
        """
        Accept the WebSocket and register it in the connection registry.
        """
        await websocket.accept()
        if conversation_id not in self._connections:
            self._connections[conversation_id] = {}
        if user_id not in self._connections[conversation_id]:
            self._connections[conversation_id][user_id] = set()
        self._connections[conversation_id][user_id].add(websocket)
        logger.info(
            "WebSocket connected: user_id=%d in conversation_id=%d (total user sockets=%d)",
            user_id,
            conversation_id,
            len(self._connections[conversation_id][user_id]),
        )

    def disconnect(
        self, conversation_id: int, user_id: int, websocket: WebSocket
    ) -> None:
        """
        Remove a WebSocket connection from the registry.
        Prunes empty user sets and empty conversation dictionaries to prevent memory leaks.
        """
        if conversation_id in self._connections:
            if user_id in self._connections[conversation_id]:
                self._connections[conversation_id][user_id].discard(websocket)
                if not self._connections[conversation_id][user_id]:
                    del self._connections[conversation_id][user_id]
            if not self._connections[conversation_id]:
                del self._connections[conversation_id]
        logger.info(
            "WebSocket disconnected: user_id=%d in conversation_id=%d",
            user_id,
            conversation_id,
        )

    async def broadcast_to_conversation(
        self, conversation_id: int, payload: Dict[str, Any]
    ) -> None:
        """
        Broadcast a JSON-serializable payload concurrently to all active sockets of all participants
        in the specified conversation.
        Safely identifies, logs, and prunes broken or closed sockets.
        """
        if conversation_id not in self._connections:
            return

        user_map = self._connections[conversation_id]
        targets = [
            (uid, ws)
            for uid, sockets in list(user_map.items())
            for ws in list(sockets)
        ]
        if not targets:
            return

        async def _safe_send(uid: int, ws: WebSocket):
            try:
                await ws.send_json(payload)
                return None
            except Exception as exc:
                logger.warning(
                    "Failed to send JSON payload to socket for user_id=%d in conversation_id=%d: %s",
                    uid,
                    conversation_id,
                    exc,
                )
                return (uid, ws)

        results = await asyncio.gather(*[_safe_send(uid, ws) for uid, ws in targets])
        for res in results:
            if res is not None:
                uid, ws = res
                self.disconnect(conversation_id, uid, ws)

    async def send_to_user(
        self, conversation_id: int, user_id: int, payload: Dict[str, Any]
    ) -> None:
        """
        Deliver a JSON-serializable payload concurrently to all active sockets of a specific participant
        within a conversation.
        """
        if conversation_id not in self._connections:
            return
        if user_id not in self._connections[conversation_id]:
            return

        sockets = list(self._connections[conversation_id][user_id])
        if not sockets:
            return

        async def _safe_send(ws: WebSocket):
            try:
                await ws.send_json(payload)
                return None
            except Exception as exc:
                logger.warning(
                    "Failed to send JSON payload to user_id=%d in conversation_id=%d: %s",
                    user_id,
                    conversation_id,
                    exc,
                )
                return ws

        results = await asyncio.gather(*[_safe_send(ws) for ws in sockets])
        for ws in results:
            if ws is not None:
                self.disconnect(conversation_id, user_id, ws)

    def get_active_users(self, conversation_id: int) -> Set[int]:
        """
        Return the set of user IDs currently connected to the conversation.
        """
        if conversation_id not in self._connections:
            return set()
        return set(self._connections[conversation_id].keys())

    def connection_count(self, conversation_id: Optional[int] = None) -> int:
        """
        Return total active socket count for a conversation, or across all conversations.
        """
        if conversation_id is not None:
            if conversation_id not in self._connections:
                return 0
            return sum(
                len(sockets) for sockets in self._connections[conversation_id].values()
            )
        return sum(
            len(sockets)
            for conv in self._connections.values()
            for sockets in conv.values()
        )

    def clear(self) -> None:
        """
        Clear all tracked connections (useful during test resets).
        """
        self._connections.clear()


# Global connection manager instance
ws_manager = WebSocketConnectionManager()
