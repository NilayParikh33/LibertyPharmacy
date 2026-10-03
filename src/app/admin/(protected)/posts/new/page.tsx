import PostForm from "@/components/admin/PostForm";
import { requireAdmin } from "@/lib/admin-auth";

// Authorization is enforced here, not only in the (protected) layout: with
// partial rendering a soft navigation re-renders just this page segment, so a
// layout-level check alone can be skipped (see SECURITY-AUDIT.md, SEC-001).
export default async function AdminNewPostPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="section-title">New Post</h1>
      <div className="mt-6 max-w-2xl">
        <PostForm />
      </div>
    </div>
  );
}
