import { notFound } from "next/navigation";
import { getPostById } from "@/lib/posts";
import PostForm from "@/components/admin/PostForm";

export default async function AdminEditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostById(Number(id));
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
