/**
 * Minimal API client. We hand-roll the surface for Sprint 1 and will switch to
 * an OpenAPI-generated client in a later sprint once routes stabilise.
 */

const BASE = "/api";

export interface SceneWithAudio {
  id: number;
  text: string;
  duration_sec: number;
  audio_path?: string | null;
  word_timings?: { word: string; start: number; end: number }[] | null;
  voice?: string | null;
  style?: string | null;
  visual_prompt?: string | null;
}

export interface Project {
  id: string;
  title: string;
  input_type: "text" | "url" | "file";
  template: string;
  aspect_ratio: "9:16" | "16:9";
  voice: string | null;
  use_agent: boolean;
  burn_subtitle: boolean;
  status: string;
  output_path: string | null;
  subtitle_path: string | null;
  error: string | null;
  storyboard: unknown;
  scenes: SceneWithAudio[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreatePayload {
  title?: string;
  input_type: "text" | "url" | "file";
  input_value?: string;
  upload_path?: string;
  template?: string;
  aspect_ratio?: "9:16" | "16:9";
  voice?: string;
  use_agent?: boolean;
  burn_subtitle?: boolean;
}

export interface ProjectUpdatePayload {
  title?: string;
  input_type?: "text" | "url" | "file";
  input_value?: string;
  upload_path?: string;
  template?: string;
  aspect_ratio?: "9:16" | "16:9";
  voice?: string;
  use_agent?: boolean;
  burn_subtitle?: boolean;
}

export interface UploadResult {
  upload_path: string;
  filename: string;
  size_bytes: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function uploadFile(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${BASE}/uploads`, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as UploadResult;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  listProjects: () => request<Project[]>("/projects"),
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (payload: ProjectCreatePayload) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: ProjectUpdatePayload) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  resetProject: (id: string) =>
    request<Project>(`/projects/${id}/reset`, { method: "POST" }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  uploadFile,
  generateStoryboard: (id: string) =>
    request<Project>(`/projects/${id}/storyboard`, { method: "POST" }),
  generateTts: (id: string, useWhisperFallback = false) =>
    request<Project>(
      `/projects/${id}/tts?use_whisper_fallback=${useWhisperFallback}`,
      { method: "POST" },
    ),
  renderVideo: (id: string, burnSubtitle = true) =>
    request<Project>(
      `/projects/${id}/render?burn_subtitle=${burnSubtitle}`,
      { method: "POST" },
    ),
  runPipeline: (id: string) =>
    request<{ job_id: string; project_id: string; status: string }>(
      `/projects/${id}/run`,
      { method: "POST" },
    ),
};

export function toStaticStorageUrl(absPath: string): string {
  // Backend stores absolute filesystem paths like
  // E:\toolVideoShort\storage\output\<id>.mp4 — convert to /static/storage/output/<id>.mp4
  // so the browser can play it through the FastAPI StaticFiles mount.
  const norm = absPath.replaceAll("\\", "/");
  const ix = norm.indexOf("/storage/");
  if (ix === -1) return absPath;
  return "/api/static" + norm.slice(ix);
}
