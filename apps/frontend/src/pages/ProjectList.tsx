import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, type Project } from "@/lib/api";

type Category = "all" | "news" | "promo" | "motivational";

const CATEGORY_LABEL: Record<Exclude<Category, "all">, string> = {
  news: "📰 News",
  promo: "🛍️ Promo",
  motivational: "🌅 Motivational",
};

export default function ProjectList() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: 0, news: 0, promo: 0, motivational: 0 };
    (data ?? []).forEach((p) => {
      acc.all += 1;
      if (acc[p.template] !== undefined) acc[p.template] += 1;
    });
    return acc;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (category === "all") return data;
    return data.filter((p) => p.template === category);
  }, [data, category]);

  if (isLoading) return <p className="text-zinc-400">Đang tải...</p>;
  if (error) return <p className="text-red-400">Lỗi: {String(error)}</p>;

  if (!data?.length) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center">
        <p className="text-zinc-400">Chưa có project nào.</p>
        <Link
          to="/new"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-fg"
        >
          Tạo project đầu tiên
        </Link>
      </div>
    );
  }

  const handleDelete = (project: Project) => {
    const ok = globalThis.confirm(
      `Xóa project "${project.title}"?\nHành động này không thể hoàn tác.`,
    );
    if (!ok) return;
    deleteMutation.mutate(project.id);
  };

  return (
    <div className="space-y-4">
      <CategoryFilter active={category} counts={counts} onChange={setCategory} />

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
          Không có project nào thuộc category này.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="group relative rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-brand"
            >
              <button
                type="button"
                onClick={() => handleDelete(p)}
                disabled={deleteMutation.isPending && deleteMutation.variables === p.id}
                title="Xóa project"
                className="absolute right-2 top-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 opacity-0 transition hover:border-red-500 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
              >
                {deleteMutation.isPending && deleteMutation.variables === p.id
                  ? "…"
                  : "🗑"}
              </button>

              <Link to={`/projects/${p.id}`} className="block pr-8">
                <h3 className="truncate font-medium">{p.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {p.template} · {p.aspect_ratio} · {p.status}
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  {new Date(p.created_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {deleteMutation.isError ? (
        <p className="text-sm text-red-400">
          Xóa thất bại: {String(deleteMutation.error)}
        </p>
      ) : null}
    </div>
  );
}

function CategoryFilter({
  active,
  counts,
  onChange,
}: Readonly<{
  active: Category;
  counts: Record<string, number>;
  onChange: (c: Category) => void;
}>) {
  const tabs: { key: Category; label: string }[] = [
    { key: "all", label: `Tất cả (${counts.all ?? 0})` },
    { key: "news", label: `${CATEGORY_LABEL.news} (${counts.news ?? 0})` },
    { key: "promo", label: `${CATEGORY_LABEL.promo} (${counts.promo ?? 0})` },
    { key: "motivational", label: `${CATEGORY_LABEL.motivational} (${counts.motivational ?? 0})` },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={
              isActive
                ? "rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg"
                : "rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
