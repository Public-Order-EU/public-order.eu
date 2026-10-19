import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Long-form pages, one Markdown file per language:
 *   src/content/pages/<lang>/<slug>.md   → id "<lang>/<slug>"
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** ISO date of the last substantive change, shown on legal pages. */
    updated: z.coerce.date().optional(),
  }),
});

/**
 * FAQ, one YAML file per language:
 *   src/content/faq/<lang>.yaml   → id "<lang>"
 */
const faq = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/faq' }),
  schema: z.object({
    items: z.array(
      z.object({
        q: z.string(),
        /** Plain text; separate paragraphs with a blank line. */
        a: z.string(),
      }),
    ),
  }),
});

export const collections = { pages, faq };
