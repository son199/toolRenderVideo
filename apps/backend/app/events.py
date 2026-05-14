"""In-process progress event bus.

Phase 1 simplification: no Redis. Each project gets per-subscriber asyncio.Queues;
``emit`` fans out to every current subscriber. A small replay buffer per project
lets late subscribers (e.g. a UI tab that opens after the job started, or after
a page reload) catch up on events emitted before they connected.

Swap with Redis pub/sub for Phase 2 (multi-process workers + horizontal scale)
by replacing this module — keep the ``emit(event)`` / ``subscribe(project_id)``
signatures stable and downstream callers won't change.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

REPLAY_BUFFER_SIZE = 200  # events retained per project for late subscribers
SUBSCRIBER_QUEUE_SIZE = 256  # bound to bound slow-consumer memory growth


@dataclass(frozen=True)
class ProgressEvent:
    project_id: str
    stage: str  # queued | ingest | storyboard | tts | render | done | error
    progress: float  # 0.0 .. 1.0
    message: str = ""
    payload: dict[str, Any] | None = None
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @property
    def is_terminal(self) -> bool:
        return self.stage in ("done", "error")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ProgressBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[asyncio.Queue[ProgressEvent]]] = defaultdict(list)
        self._replay: dict[str, deque[ProgressEvent]] = defaultdict(
            lambda: deque(maxlen=REPLAY_BUFFER_SIZE)
        )
        self._lock = asyncio.Lock()

    async def emit(self, event: ProgressEvent) -> None:
        async with self._lock:
            self._replay[event.project_id].append(event)
            queues = list(self._subscribers.get(event.project_id, []))
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer — drop the event for that queue only.
                logger.warning(
                    "ProgressBus dropped event for slow subscriber on %s",
                    event.project_id,
                )

    async def subscribe(self, project_id: str) -> AsyncIterator[ProgressEvent]:
        queue: asyncio.Queue[ProgressEvent] = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_SIZE)
        async with self._lock:
            for past in list(self._replay.get(project_id, [])):
                try:
                    queue.put_nowait(past)
                except asyncio.QueueFull:
                    break
            self._subscribers[project_id].append(queue)

        try:
            while True:
                event = await queue.get()
                yield event
                if event.is_terminal:
                    break
        finally:
            async with self._lock:
                if queue in self._subscribers[project_id]:
                    self._subscribers[project_id].remove(queue)

    def replay(self, project_id: str) -> list[ProgressEvent]:
        """Snapshot of the replay buffer — useful for tests and `GET /events` polling."""
        return list(self._replay.get(project_id, []))


_BUS = ProgressBus()


def get_bus() -> ProgressBus:
    return _BUS
