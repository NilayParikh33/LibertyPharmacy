import { notFound } from "next/navigation";
import { getPostById } from "@/lib/posts";
import PostForm from "@/components/admin/PostForm";
import { requireAdmin } from "@/lib/admin-auth";
import { parseId } from "@/lib/ids";

// Authorization is enforced here, not only in the (protected) layout: with
// partial rendering a soft navigation re-renders just this page segment, so a
// layout-level check alone can be skipped (see SECURITY-AUDIT.md, SEC-001).
export default async function AdminEditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = parseId((await params).id);
  if (id === null) notFound();
  const post = await getPostById(id);
  if (!post) notFound();

  return (
    <div>
      <h1 className="section-title">Edit Post</h1>
      <div className="mt-6 max-w-2xl">
        <PostForm post={post} />
      </div>
    </div>
  );
}
