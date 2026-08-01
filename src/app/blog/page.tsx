import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { posts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Health tips, pharmacy news, and wellness guidance from the Liberty Pharmacy team.",
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BlogIndexPage() {
  return (
    <>
      <PageHero
        title="Health & Wellness Blog"
        subtitle="Practical guidance from your neighborhood pharmacists."
      />

      <section className="py-16">
        <div className="container-site grid gap-8 sm:grid-cols-2">
          {posts.map((post) => (
            <article key={post.slug} className="card flex flex-col">
              <p className="text-xs font-medium uppercase tracking-wide text-liberty-red">
                {formatDate(post.date)} · {post.readMinutes} min read
              </p>
              <h2 className="mt-2 text-xl font-bold text-navy-900">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{post.excerpt}</p>
              <p className="mt-4 text-sm text-slate-500">By {post.author}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-4 text-sm font-semibold text-navy-700 hover:underline"
              >
                Read article →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
