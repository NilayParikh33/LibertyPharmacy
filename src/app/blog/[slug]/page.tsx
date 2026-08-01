import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, posts } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Article Not Found" };
  return { title: post.title, description: post.excerpt };
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="py-16">
      <div className="container-site max-w-3xl">
        <Link href="/blog" className="text-sm font-semibold text-navy-700 hover:underline">
          ← Back to blog
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          By {post.author} · {formatDate(post.date)} · {post.readMinutes} min read
        </p>

        <div className="mt-10 space-y-8">
          {post.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-bold text-navy-900">{s.heading}</h2>
              <p className="mt-3 leading-7 text-slate-600">{s.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-navy-50 p-6 text-sm text-slate-600">
          The content on this blog is for general information only and is not
          medical advice. Always consult your physician or pharmacist about
          your specific health needs.
        </div>
      </div>
    </article>
  );
}
