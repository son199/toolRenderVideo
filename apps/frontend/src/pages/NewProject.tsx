import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api, type ProjectCreatePayload } from "@/lib/api";

type InputType = "text" | "url" | "file";

const TEMPLATES = ["news", "promo", "motivational"] as const;
const ASPECTS = ["9:16", "16:9"] as const;

export default function NewProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [inputType, setInputType] = useState<InputType>("text");
  const [inputValue, setInputValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]>("news");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("9:16");
  const [voice, setVoice] = useState("vi-VN-HoaiMyNeural");
  const [useAgent, setUseAgent] = useState(true);
  const [burnSubtitle, setBurnSubtitle] = useState(false);

  const submit = useMutation({
    mutationFn: async (): Promise<ReturnType<typeof api.createProject> extends Promise<infer P> ? P : never> => {
      const payload: ProjectCreatePayload = {
        title: title || "Untitled",
        input_type: inputType,
        template,
        aspect_ratio: aspect,
        voice,
        use_agent: useAgent,
        burn_subtitle: burnSubtitle,
      };

      if (inputType === "file") {
        if (!file) throw new Error("Vui lòng chọn file để upload");
        const upload = await api.uploadFile(file);
        payload.upload_path = upload.upload_path;
        if (!title) payload.title = upload.filename;
      } else {
        if (!inputValue) throw new Error("Vui lòng nhập nội dung hoặc URL");
        payload.input_value = inputValue;
      }

      return api.createProject(payload);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}`);
    },
  });

  return (
    <form
      className="mx-auto max-w-2xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <h2 className="text-xl font-semibold">Project mới</h2>

      <div>
        <label className="text-sm text-zinc-400">Tiêu đề</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 focus:border-brand focus:outline-none"
        />
      </div>

      <div>
        <label className="text-sm text-zinc-400">Loại đầu vào</label>
        <div className="mt-1 flex gap-2">
          {(["text", "url", "file"] as InputType[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setInputType(t)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                inputType === t
                  ? "border-brand bg-brand text-brand-fg"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {inputType === "url" && (
        <div>
          <label className="text-sm text-zinc-400">URL bài viết</label>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
      )}

      {inputType === "text" && (
        <div>
          <label className="text-sm text-zinc-400">Nội dung text</label>
          <textarea
            rows={8}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Dán nội dung text vào đây..."
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
      )}

      {inputType === "file" && (
        <div>
          <label className="text-sm text-zinc-400">File (PDF, DOCX, TXT, MD — tối đa 20MB)</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1 file:text-brand-fg"
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">
              {file.name} · {Math.round(file.size / 1024)} KB
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm text-zinc-400">Template</label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as (typeof TEMPLATES)[number])}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Tỉ lệ</label>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as (typeof ASPECTS)[number])}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Voice</label>
          <input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-brand/60">
        <input
          type="checkbox"
          aria-label="Use AI Agent"
          checked={useAgent}
          onChange={(e) => setUseAgent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <div className="text-sm">
          <div className="font-medium text-zinc-200">🤖 Use AI Agent</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Chain phân tích → draft → review → refine. Chất lượng cao hơn rõ rệt
            nhưng tốn ~3-5× token và chậm hơn ~40-60s ở bước storyboard.
          </div>
        </div>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-brand/60">
        <input
          type="checkbox"
          aria-label="Burn subtitle"
          checked={burnSubtitle}
          onChange={(e) => setBurnSubtitle(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand"
        />
        <div className="text-sm">
          <div className="font-medium text-zinc-200">🎬 Hiển thị phụ đề</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Burn subtitle vào video. Tắt nếu không muốn hiện phụ đề trong video xuất ra.
          </div>
        </div>
      </label>

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={submit.isPending}
          className="rounded-md bg-brand px-4 py-2 font-medium text-brand-fg disabled:opacity-50"
        >
          {submit.isPending ? "Đang xử lý..." : "Tạo & ingest"}
        </button>
        {submit.error && (
          <span className="text-sm text-red-400">{String(submit.error)}</span>
        )}
      </div>
    </form>
  );
}
