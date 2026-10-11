import { z } from "zod";

/** Blog post fields, shared by the create and update admin routes. Kept out of
 * the route files, which may only export route handlers. */
export const postSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().trim().min(1, "Title is required").max(200),
  excerpt: z.string().trim().min(1, "Excerpt is required").max(400),
  author: z.string().trim().min(1, "Author is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  readMinutes: z.number().int().min(1).max(60),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1, "Section heading is required").max(200),
        body: z.string().trim().min(1, "Section body is required").max(5000),
      })
    )
    .min(1, "At least one section is required"),
});
