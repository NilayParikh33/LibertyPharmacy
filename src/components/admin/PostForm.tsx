"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Post } from "@/lib/posts";

type Section = { heading: string; body: string };

export default function PostForm({ post }: { post?: Post }) {
  const router = useRouter();
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [author, setAuthor] = useState(post?.author ?? "Liberty Pharmacy Team");
  const [date, setDate] = useState(post?.date ?? new Date().toISOString().slice(0, 10));
  const [readMinutes, setReadMinutes] = useState(post?.readMinutes ?? 3);
  const [sections, setSections] = useState<Section[]>(post?.sections ?? [{ heading: "", body: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateSection(i: number, field: keyof Section, value: string) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { heading: "", body: "" }]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = { slug, title, excerpt, author, date, readMinutes: Number(readMinutes), sections };
      const res = await fetch(post ? `/api/admin/posts/${post.id}` : "/api/admin/posts", {
        method: post ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/admin/posts");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="title"
            required
            maxLength={200}
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="slug" className="mb-1.5 block text-sm font-medium text-slate-700">
            Slug
          </label>
          <input
            id="slug"
            required
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className="input-field"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="excerpt" className="mb-1.5 block text-sm font-medium text-slate-700">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          required
          rows={2}
          maxLength={400}
          className="input-field"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label htmlFor="author" className="mb-1.5 block text-sm font-medium text-slate-700">
            Author
          </label>
          <input
            id="author"
            required
            maxLength={100}
            className="input-field"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="date" className="mb-1.5 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="date"
            type="date"
            required
            className="input-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="readMinutes" className="mb-1.5 block text-sm font-medium text-slate-700">
            Read minutes
          </label>
          <input
            id="readMinutes"
            type="number"
            min={1}
            max={60}
            required
            className="input-field"
            value={readMinutes}
            onChange={(e) => setReadMinutes(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Sections</h2>
          <button type="button" onClick={addSection} className="btn-outline !px-3 !py-1.5 text-xs">
            + Add section
          </button>
        </div>
        <div className="mt-3 space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <input
                  placeholder="Heading"
                  required
                  maxLength={200}
                  className="input-field"
                  value={s.heading}
                  onChange={(e) => updateSection(i, "heading", e.target.value)}
                />
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSection(i)}
                    className="shrink-0 text-xs font-medium text-liberty-red hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                placeholder="Body"
                required
                rows={3}
                maxLength={5000}
                className="input-field mt-3"
                value={s.body}
                onChange={(e) => updateSection(i, "body", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
        {busy ? "Saving…" : post ? "Save changes" : "Create post"}
      </button>
    </form>
  );
}
