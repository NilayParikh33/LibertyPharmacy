import PostForm from "@/components/admin/PostForm";

export default function AdminNewPostPage() {
  return (
    <div>
      <h1 className="section-title">New Post</h1>
      <div className="mt-6 max-w-2xl">
        <PostForm />
      </div>
    </div>
  );
}
