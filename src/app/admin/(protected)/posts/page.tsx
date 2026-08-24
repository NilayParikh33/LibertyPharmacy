import Link from "next/link";
import { getPosts } from "@/lib/posts";
import DeletePostButton from "@/components/admin/DeletePostButton";

export default async function AdminPostsPage() {
  const posts = await getPosts();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="section-title">Blog Posts</h1>
        <Link href="/admin/posts/new" className="btn-primary">
          + New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="card mt-6 text-sm text-slate-600">No posts yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-navy-900">{p.title}</p>
                <p className="text-sm text-slate-500">
                  /blog/{p.slug} · {p.date}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link href={`/admin/posts/${p.id}`} className="text-sm font-medium text-navy-700 hover:underline">
                  Edit
                </Link>
                <DeletePostButton id={p.id} title={p.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
