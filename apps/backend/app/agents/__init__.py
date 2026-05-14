"""Agent layer — chains LLM calls into analyze → draft → review → refine flow.

Top-level entrypoint is ``VideoCreatorAgent`` (lazy-loaded via PEP 562 to keep
partial builds runnable). Phase 1 single-shot path remains available via
``LLMProvider.generate_storyboard``.
"""

from app.agents.base import AgentError, BaseAgent, ProgressCallback


def __getattr__(name: str):
    if name == "VideoCreatorAgent":
        from app.agents.video_creator import VideoCreatorAgent

        return VideoCreatorAgent
    raise AttributeError(name)


__all__ = ["AgentError", "BaseAgent", "ProgressCallback", "VideoCreatorAgent"]
