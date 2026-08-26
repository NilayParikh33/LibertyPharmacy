import { getDb } from "./db";

/**
 * Blog content — admin-managed, stored in the `posts` table (see
 * src/lib/db.ts). Swap this module for a CMS/MDX pipeline later without
 * touching the page components, which only use the functions below.
 */
export type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readMinutes: number;
  sections: Array<{ heading: string; body: string }>;
};

export interface PostInput {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readMinutes: number;
  sections: Array<{ heading: string; body: string }>;
}

interface PostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  read_minutes: number;
  sections_json: string;
}

function fromRow(row: PostRow): Post {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author,
    date: row.date,
    readMinutes: row.read_minutes,
    sections: JSON.parse(row.sections_json),
  };
}

export async function getPosts(): Promise<Post[]> {
  const db = await getDb();
  const rows = await db.prepare("SELECT * FROM posts ORDER BY date DESC, id DESC").all<PostRow>();
  return rows.map(fromRow);
}

export async function getPost(slug: string): Promise<Post | undefined> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM posts WHERE slug = ?").get<PostRow>(slug);
  return row ? fromRow(row) : undefined;
}

export async function getPostById(id: number): Promise<Post | undefined> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM posts WHERE id = ?").get<PostRow>(id);
  return row ? fromRow(row) : undefined;
}

export async function createPost(input: PostInput): Promise<number> {
  const db = await getDb();
  const result = await db
    .prepare(
      `INSERT INTO posts (slug, title, excerpt, author, date, read_minutes, sections_json)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
    .run(input.slug, input.title, input.excerpt, input.author, input.date, input.readMinutes, JSON.stringify(input.sections));
  return result.lastInsertRowid;
}

export async function updatePost(id: number, input: PostInput): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE posts SET slug = ?, title = ?, excerpt = ?, author = ?, date = ?, read_minutes = ?, sections_json = ?,
       updated_at = ? WHERE id = ?`
    )
    .run(input.slug, input.title, input.excerpt, input.author, input.date, input.readMinutes, JSON.stringify(input.sections), new Date().toISOString(), id);
}

export async function deletePost(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM posts WHERE id = ?").run(id);
}
