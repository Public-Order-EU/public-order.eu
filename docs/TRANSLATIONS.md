# Translations

English is the source language. Every other language can be translated one piece at a
time. Until a language is complete, its pages fall back to English and show a short
notice inviting people to help translate.

Each language has three things to translate:

| What | File | Notes |
| --- | --- | --- |
| Interface strings | `src/i18n/ui/<lang>.json` | Buttons, form, home page, key points… |
| Long pages | `src/content/pages/<lang>/petition.md`, `privacy.md`, `legal.md` | Copy the English file and translate it |
| FAQ | `src/content/faq/<lang>.yaml` | Copy `en.yaml` and translate it |

Language codes: `en fr de nl es it pt pl da sv no fi et lv lt`.

## 1. Interface strings (`ui/<lang>.json`)

The structure of each file mirrors `src/i18n/ui/en.json`. Each language file is
**merged over English**, so you only need to include the keys you have translated.
Anything missing is shown in English.

```json
{
  "_status": "untranslated",
  "nav": { "language": "Sprache" },
  "home": {
    "title": "Friedlichen Protest schützen. Gewalt stoppen.",
    "lead": "…"
  }
}
```

Rules:

- **Keep the keys** exactly as they are in `en.json`. Translate only the values.
- **Keep `{placeholders}`** such as `{goal}`, `{percent}`, `{language}`, `{email}` or `{privacyLink}`
  unchanged. You may move them within the sentence. The checker reports placeholders it
  does not know, because they would show up literally on the page.
- **Arrays**, such as the key points, must have the same number of items as in English.
- Keys starting with `_` are metadata and are not shown on the site.
- Write in the same tone as the English: factual, calm, and respectful of people who
  disagree. Do not add claims that are not in the English text.

### `_status`

| Value | Meaning |
| --- | --- |
| `"untranslated"` | Work in progress (the default). Pages show the "not yet translated" notice, set their canonical URL to the English page and stay out of the sitemap. |
| `"complete"` | Everything is translated and reviewed. The language becomes a full version of the site: its own canonical URLs, in the sitemap, `hreflang` alternates, and visitors whose browser prefers it are sent there from `/`. |

Set `"complete"` only after the UI, all three pages and the FAQ have been translated
**and reviewed by a second fluent speaker**. The petition text and the privacy policy are
public commitments, so translations must not change their meaning. For the privacy policy
and the legal notice, a legal review in that language is recommended.

## 2. Long pages (`content/pages/<lang>/*.md`)

Copy `src/content/pages/en/petition.md` to `src/content/pages/de/petition.md` and translate
it. The front matter at the top is translated too:

```md
---
title: Friedlichen Protest schützen. Krawallgewalt stoppen.
description: Der vollständige Text der European Public Order Initiative …
updated: 2026-10-19
---
```

- `title` and `description` are used in the page heading, the search result and the
  social-media preview. Keep the description under about 160 characters. If a value
  contains a colon followed by a space (`Initiative: fünf …`), put it in double quotes, or
  the page will not build; `pnpm i18n:check` reports this.
- `updated` is the date of the last change *in meaning*. Keep the English date unless the
  translation was made from a newer version.
- Keep Markdown formatting (`##` headings, `**bold**`, lists) and relative links such as
  `../privacy/`.
- Keep the project name **European Public Order Initiative** untranslated. Never add the
  names of individuals: the petition is presented collectively.

If a page file is missing for a language, the English page is shown with the notice.

## 3. FAQ (`content/faq/<lang>.yaml`)

```yaml
items:
  - q: Wer steht hinter dieser Petition?
    a: |
      Die European Public Order Initiative wird gemeinsam …

      Second paragraph after a blank line.
```

Keep the same questions in the same order as in English. Indent the answer by six
spaces under `a: |` and separate paragraphs with a blank line.

## Checking your work

```sh
pnpm i18n:check       # all languages: progress, problems
pnpm i18n:check de    # one language, listing every missing key
```

Example output:

```
de  [untranslated]  UI 48/126 strings  |  ✗ legal  ✓ petition  ✗ privacy  ✗ faq
  ! counter.goal: unknown placeholder {goals}
  ? counter.progress: does not use {percent}
  (78 strings fall back to English)
```

- `!` is an **error**: an unknown key (probably a typo), an unknown placeholder, or a
  wrong number of array items. Fix it.
- `?` is a **warning**: the translation leaves out a placeholder used in English. This is
  sometimes fine (for example, if the sentence reads better without the language name),
  but check it.
- The command fails (exit code 1) if a language marked `"complete"` has missing strings,
  missing pages or errors, so you can run it in CI.

Then run `pnpm build` and look at the pages with `pnpm dev`
(`http://localhost:4321/de/`). Check long words on a phone-sized window, especially for
fi, de, et, lv and lt.

## Country names and dates

Country names in the form and dates on the legal pages are produced automatically for
each language by the browser's and Node's `Intl` APIs. You do not need to translate them.

## Adding a new language

1. Add its code to `locales` and `localeInfo` in `src/i18n/locales.ts`.
2. Add it to the `i18n.locales` array in `astro.config.mjs`.
3. Create `src/i18n/ui/<code>.json` with `{ "_status": "untranslated" }` and import it in
   `src/i18n/dictionaries.ts`.
4. Translate as described above.
