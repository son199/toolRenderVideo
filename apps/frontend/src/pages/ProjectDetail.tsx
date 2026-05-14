import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { api, toStaticStorageUrl, type Project, type ProjectUpdatePayload } from "@/lib/api";
import { subscribeProjectEvents, type ProgressEvent } from "@/lib/ws";

const STAGE_LABELS: Record<string, string> = {
  queued: "Đang xếp hàng",
  ingest: "Ingest",
  storyboard: "Storyboard",
  tts: "Audio",
  render: "Render",
  done: "Hoàn tất",
  error: "Lỗi",
};

const TEMPLATES = ["news", "promo", "motivational"] as const;
const ASPECTS = ["9:16", "16:9"] as const;

function renderButtonLabel(isPending: boolean, hasOutput: boolean): string {
  if (isPending) return "Đang render (Playwright + FFmpeg)...";
  return hasOutput ? "Render lại" : "Render video";
}

function buildEditPayload(data: Project, form: ProjectUpdatePayload): ProjectUpdatePayload {
  // Only include changed fields so PATCH stays minimal.
  const out: ProjectUpdatePayload = {};
  if (form.title !== undefined && form.title !== data.title) out.title = form.title;
  if (form.template !== undefined && form.template !== data.template) out.template = form.template;
  if (form.aspect_ratio !== undefined && form.aspect_ratio !== data.aspect_ratio)
    out.aspect_ratio = form.aspect_ratio;
  if (form.voice !== undefined && form.voice !== (data.voice ?? "")) out.voice = form.voice;
  if (form.use_agent !== undefined && form.use_agent !== data.use_agent)
    out.use_agent = form.use_agent;
  if (form.burn_subtitle !== undefined && form.burn_subtitle !== data.burn_subtitle)
    out.burn_subtitle = form.burn_subtitle;
  return out;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: Boolean(id),
  });

  const generateStoryboard = useMutation({
    mutationFn: () => api.generateStoryboard(id!),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", id], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const generateTts = useMutation({
    mutationFn: () => api.generateTts(id!),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", id], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const renderVideo = useMutation({
    mutationFn: () => api.renderVideo(id!),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", id], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // --- Edit form (Phase 2H) ---
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ProjectUpdatePayload>({});

  const updateProject = useMutation({
    mutationFn: (payload: ProjectUpdatePayload) => api.updateProject(id!, payload),
    onSuccess: (project) => {
      queryClient.setQueryData(["project", id], project);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditing(false);
    },
  });

  function openEdit(p: Project) {
    setEditForm({
      title: p.title,
      template: p.template,
      aspect_ratio: p.aspect_ratio,
      voice: p.voice ?? "",
      use_agent: p.use_agent,
      burn_subtitle: p.burn_subtitle,
    });
    setEditing(true);
  }

  function saveEdit(p: Project) {
    const patch = buildEditPayload(p, editForm);
    if (Object.keys(patch).length === 0) {
      setEditing(false); // nothing changed
      return;
    }
    updateProject.mutate(patch);
  }

  // --- Full pipeline (background) + WS progress ---
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [running, setRunning] = useState(false);
  const subRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    return () => subRef.current?.close();
  }, []);

  function startSubscription() {
    subRef.current?.close();
    setEvents([]);
    setRunning(true);
    subRef.current = subscribeProjectEvents(
      id!,
      (event) => {
        setEvents((prev) => [...prev.slice(-49), event]);
        if (event.stage === "done" || event.stage === "error") {
          setRunning(false);
          queryClient.invalidateQueries({ queryKey: ["project", id] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }
      },
      {
        onClose: () => setRunning(false),
        onError: () => setRunning(false),
      },
    );
  }

  const runPipeline = useMutation({
    mutationFn: async () => {
      startSubscription();
      return api.runPipeline(id!);
    },
    onError: () => setRunning(false),
  });

  // --- Re-run: reset derived data then run pipeline again (Phase 2H) ---
  const rerunPipeline = useMutation({
    mutationFn: async () => {
      startSubscription();
      await api.resetProject(id!);
      return api.runPipeline(id!);
    },
    onError: () => setRunning(false),
  });

  function handleRerun() {
    const ok = window.confirm(
      "Chạy lại pipeline?\n\n" +
        "Storyboard / audio / video hiện tại sẽ bị xoá và sinh lại từ đầu " +
        "(ingest → storyboard → TTS → render).\n\nFile cũ sẽ bị ghi đè khi render xong.",
    );
    if (ok) rerunPipeline.mutate();
  }

  if (isLoading) return <p className="text-zinc-400">Đang tải...</p>;
  if (error) return <p className="text-red-400">Lỗi: {String(error)}</p>;
  if (!data) return null;

  const canGenerateStoryboard =
    !data.storyboard && data.status !== "failed" && data.status !== "draft";
  const canGenerateTts =
    Boolean(data.storyboard) && data.status !== "tts_ready" && data.status !== "completed";
  const canRender = data.status === "tts_ready" || data.status === "failed";

  const latestEvent = events.at(-1);
  const progress = latestEvent ? Math.round(latestEvent.progress * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            <span className="truncate">{data.title}</span>
            {data.use_agent && (
              <span
                title="AI Agent: phân tích + draft + review + refine"
                className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-medium text-brand-fg"
              >
                🤖 AI Agent
              </span>
            )}
          </h2>
          <p className="text-sm text-zinc-500">
            {data.template} · {data.aspect_ratio} · trạng thái:{" "}
            <span className="text-zinc-300">{data.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => (editing ? setEditing(false) : openEdit(data))}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
          >
            {editing ? "Đóng edit" : "✏️ Edit"}
          </button>
          <button
            onClick={handleRerun}
            disabled={running || rerunPipeline.isPending}
            className="rounded-md border border-amber-700/60 bg-amber-900/20 px-3 py-1.5 text-sm text-amber-200 hover:border-amber-500 disabled:opacity-50"
          >
            {rerunPipeline.isPending ? "Đang chạy lại..." : "🔁 Chạy lại pipeline"}
          </button>
          <Link to="/" className="text-sm text-zinc-400 hover:text-white">
            ← Quay lại
          </Link>
        </div>
      </div>

      {/* Edit form — collapsible inline section */}
      {editing && (
        <section className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Edit project metadata</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Tiêu đề</label>
              <input
                value={editForm.title ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-zinc-400">Template</label>
                <select
                  value={editForm.template ?? "news"}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      template: e.target.value as (typeof TEMPLATES)[number],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Tỉ lệ</label>
                <select
                  value={editForm.aspect_ratio ?? "9:16"}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      aspect_ratio: e.target.value as (typeof ASPECTS)[number],
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                >
                  {ASPECTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400">Voice</label>
                <input
                  value={editForm.voice ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, voice: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  aria-label="Use AI Agent"
                  checked={editForm.use_agent ?? false}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, use_agent: e.target.checked }))
                  }
                  className="h-4 w-4 accent-brand"
                />
                🤖 Use AI Agent
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  aria-label="Burn subtitle"
                  checked={editForm.burn_subtitle ?? true}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, burn_subtitle: e.target.checked }))
                  }
                  className="h-4 w-4 accent-brand"
                />
                🎬 Burn subtitle vào video
              </label>
            </div>

            <p className="text-xs text-zinc-500">
              Lưu ý: đổi template / aspect / voice không tự động re-render. Bấm{" "}
              <span className="text-amber-300">🔁 Chạy lại pipeline</span> sau khi save
              nếu muốn áp dụng cho video mới.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                disabled={updateProject.isPending}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500"
              >
                Huỷ
              </button>
              <button
                onClick={() => saveEdit(data)}
                disabled={updateProject.isPending}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg disabled:opacity-50"
              >
                {updateProject.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>

            {updateProject.error && (
              <p className="text-sm text-red-400">{String(updateProject.error)}</p>
            )}
          </div>
        </section>
      )}

      {rerunPipeline.error && (
        <p className="text-sm text-red-400">Lỗi chạy lại: {String(rerunPipeline.error)}</p>
      )}

      {/* Full pipeline runner */}
      <section className="rounded-lg border border-brand/40 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">
            Pipeline (chạy nền + progress realtime)
          </h3>
          <button
            onClick={() => runPipeline.mutate()}
            disabled={running || runPipeline.isPending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg disabled:opacity-50"
          >
            {running ? "Đang chạy..." : "Run full pipeline"}
          </button>
        </div>

        {(running || events.length > 0) && (
          <>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                {latestEvent
                  ? `[${STAGE_LABELS[latestEvent.stage] ?? latestEvent.stage}] ${latestEvent.message}`
                  : "Đang khởi tạo..."}
              </span>
              <span>{progress}%</span>
            </div>

            {events.length > 1 && (
              <details className="mt-3 text-xs text-zinc-500">
                <summary className="cursor-pointer">Event log ({events.length})</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded bg-zinc-950 p-2 font-mono">
                  {events.map((e, idx) => (
                    <li key={`${e.timestamp}-${idx}`} className="text-zinc-400">
                      <span className="text-zinc-600">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </span>{" "}
                      <span className="text-brand">{e.stage}</span>{" "}
                      <span className="text-zinc-600">
                        {Math.round(e.progress * 100)}%
                      </span>{" "}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        {runPipeline.error && (
          <p className="mt-2 text-sm text-red-400">{String(runPipeline.error)}</p>
        )}
      </section>

      {data.error && (
        <div className="rounded-md border border-red-700 bg-red-900/20 p-3 text-sm text-red-200">
          {data.error}
        </div>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-300">Storyboard</h3>
          {canGenerateStoryboard && (
            <button
              onClick={() => generateStoryboard.mutate()}
              disabled={generateStoryboard.isPending}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              {generateStoryboard.isPending ? "Đang sinh..." : "Generate (chỉ storyboard)"}
            </button>
          )}
        </div>

        {data.storyboard ? (
          <pre className="max-h-[40vh] overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-300">
            {JSON.stringify(data.storyboard, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-zinc-500">
            {data.status === "ingested"
              ? "Đã ingest. Bấm Run full pipeline ở trên để tiếp tục."
              : "Chưa có storyboard."}
          </p>
        )}

        {generateStoryboard.error && (
          <p className="mt-2 text-sm text-red-400">{String(generateStoryboard.error)}</p>
        )}
      </section>

      {data.storyboard && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Audio & subtitle</h3>
            {canGenerateTts && (
              <button
                onClick={() => generateTts.mutate()}
                disabled={generateTts.isPending}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                {generateTts.isPending ? "Đang tạo audio..." : "Generate (chỉ audio)"}
              </button>
            )}
          </div>

          {data.scenes?.some((s) => s.audio_path) ? (
            <ul className="space-y-2">
              {data.scenes.map((scene) => (
                <li
                  key={scene.id}
                  className="rounded border border-zinc-800 bg-zinc-950 p-2 text-xs"
                >
                  <div className="mb-1 text-zinc-400">
                    [{scene.id}] {scene.duration_sec?.toFixed(2)}s ·{" "}
                    {scene.word_timings?.length
                      ? `${scene.word_timings.length} words timed`
                      : "no timings"}
                  </div>
                  <div className="mb-2 text-zinc-200">{scene.text}</div>
                  {scene.audio_path && (
                    <p className="truncate text-zinc-600">{scene.audio_path}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">Chưa có audio.</p>
          )}

          {data.subtitle_path && (
            <p className="mt-3 text-xs text-zinc-500">
              Subtitle: <span className="text-zinc-400">{data.subtitle_path}</span>
            </p>
          )}

          {generateTts.error && (
            <p className="mt-2 text-sm text-red-400">{String(generateTts.error)}</p>
          )}
        </section>
      )}

      {data.storyboard && data.scenes?.some((s) => s.audio_path) && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-300">Video</h3>
            {canRender && (
              <button
                onClick={() => renderVideo.mutate()}
                disabled={renderVideo.isPending}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                {renderButtonLabel(renderVideo.isPending, Boolean(data.output_path))}
              </button>
            )}
          </div>

          {data.output_path ? (
            <video
              key={data.output_path}
              src={toStaticStorageUrl(data.output_path)}
              controls
              className="w-full max-w-md rounded-lg bg-black"
            >
              <track kind="captions" />
            </video>
          ) : (
            <p className="text-sm text-zinc-500">
              {data.status === "rendering"
                ? "Đang render..."
                : "Chưa render. Bấm Run full pipeline hoặc Render video."}
            </p>
          )}

          {renderVideo.error && (
            <p className="mt-2 text-sm text-red-400">{String(renderVideo.error)}</p>
          )}
        </section>
      )}
    </div>
  );
}
