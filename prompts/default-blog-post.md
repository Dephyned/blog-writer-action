# Generate a New Blog Post

You are generating a new SEO-optimized blog post.

## Efficiency Constraints

You have a limited number of tool-call turns. Follow these rules strictly:
- **Do NOT read entire data files** — use Grep to extract only the information you need (slugs, titles).
- **Use Read with offset/limit** when you need to see specific lines of a file.
- **Plan your Edit carefully** — read only the lines around the insertion point before editing.
- Target approximately **4 tool calls total**: 2 Grep calls (slugs + titles), 1 targeted Read (insertion point), 1 Edit (insert post).

## Parameters

- **Topic**: `{{TOPIC}}`
- **Location Focus**: `{{LOCATION}}`
- **Publish Date**: `{{DATE}}`

## Instructions

### Step 1: Check Existing Posts

Use Grep to find existing slugs and titles in the project's blog data file — do NOT read the entire file.

1. Grep for slugs (e.g., pattern `slug:` or `"slug"`) to get all existing slugs
2. Grep for titles (e.g., pattern `title:` or `"title"`) to get all existing titles

These two Grep calls give you everything needed to avoid duplicates. Do NOT read the full file.

### Step 2: Generate a Unique Blog Post

Write a new blog post that:

1. **Is 800-1200 words** of high-quality, original content
2. **Targets a unique long-tail keyword** related to `{{TOPIC}}` in `{{LOCATION}}` that none of the existing posts already target
3. **Includes location-specific details** — mention real neighborhoods, landmarks, and local conditions specific to `{{LOCATION}}`
4. **Uses proper markdown structure**: H2 (`##`) and H3 (`###`) headers, bullet points, and bold text for emphasis
5. **Has a natural, helpful tone** — not salesy or spammy. Write as a knowledgeable local expert.

### Step 3: Add the Post to the Data File

Add the new post to the project's blog data file, following the existing format exactly. Insert it as the **first item** (newest first).

1. First, use `Read` with a small `limit` to see the exact text around the array/list opening.
2. Use the `Edit` tool to insert the new post immediately after the opening and before the existing first post.

## Important Rules

1. **DO NOT duplicate any existing slug** — check all slugs in the file before choosing yours
2. **DO NOT repeat the same topic angle** as an existing post — find a fresh angle
3. **DO include the location name** in the slug, title, and naturally throughout the content
4. **DO make content genuinely useful** — include specific advice, numbers, and local knowledge
5. **DO keep the metaTitle under 60 characters** and metaDescription under 160 characters
6. **DO set readTime** based on actual word count (average reading speed: 200 words/minute)
7. **DO add the post as the FIRST item** in the data file
8. **CRITICAL: Match the existing data format exactly** — if the file uses template literals, do NOT use backtick characters inside content fields. Use **bold** instead of inline code.
