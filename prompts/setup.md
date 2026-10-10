# Set Up the Blog Writer for This Repo

You are setting up an automated blog writer for this website's repository. A scheduled job will later use the files you write to add one SEO blog post per run. Your job right now is only to inspect the repo and write two files. Do not write any blog posts.

## Step 1: Find the Blog

Use Glob and Grep to find where blog posts are stored. Common shapes:

- A data file holding an array of posts (e.g. `src/data/blogPosts.ts`, `src/data/posts.json`)
- A folder of markdown or MDX files (e.g. `content/blog/*.md`, `src/posts/*.mdx`)

Read one or two existing posts to learn the exact format: field names, date format, how content is written, and how slugs look.

**If there is no blog** (no posts data file, no posts folder, and nowhere posts are rendered), stop. Write `{{SETUP_RESULT_PATH}}` containing:

```json
{ "status": "no-blog", "reason": "<one sentence on what you looked for and didn't find>" }
```

Do not write any other files in that case.

## Step 2: Learn About the Business

From the site's pages, components, constants, and README, find:

- The business name, phone number, and website domain
- The services it offers (these become topics, written as short kebab-case slugs like `window-cleaning`)
- The cities or areas it serves (these become locations)

Only use facts you actually find in the repo. If no service areas are listed, use the single city the business is based in.

## Step 3: Write `{{CONFIG_PATH}}`

Write valid JSON with these fields:

```json
{
  "promptTemplatePath": "{{PROMPT_TEMPLATE_PATH}}",
  "placeholders": {
    "COMPANY_NAME": "<business name>",
    "PHONE": "<phone>",
    "WEBSITE": "<domain>"
  },
  "topicSchedule": {
    "0": "<topic>", "1": "<topic>", "2": "<topic>", "3": "<topic>",
    "4": "<topic>", "5": "<topic>", "6": "<topic>"
  },
  "locations": ["<city>", "<city>"],
  "postCountCommand": "<shell command that prints the number of existing posts>",
  "claude": { "allowedTools": "Read,Edit,Glob,Grep", "maxTurns": 25 },
  "buildCommand": "<the repo's build command, or empty string if none>",
  "filesToCommit": ["<file or folder that new posts are added to>"],
  "commitMessage": "feat(blog): add blog post - {topic} ({location})"
}
```

Rules:
- `topicSchedule` keys are days of the week (0 = Sunday). Spread the main services across the week, weighting the most important service.
- `postCountCommand` must work from the repo root, e.g. `grep -c "slug:" src/data/blogPosts.ts || echo 0` or `ls content/blog/*.md | wc -l`.
- If posts are separate files, use `"Read,Write,Edit,Glob,Grep"` for `allowedTools` so new files can be created, and put the posts folder in `filesToCommit`.
- `buildCommand` should be the `build` script from `package.json` (e.g. `npm run build`) if one exists.

## Step 4: Write `{{PROMPT_TEMPLATE_PATH}}`

This is the prompt the scheduled job sends each run. Start from the reference template below and adapt it to this repo:

- Name the exact file or folder posts go in and describe the exact post format you found (fields, date format, slug style), with a short skeleton of one post.
- Use `{{COMPANY_NAME}}`, `{{PHONE}}`, and `{{WEBSITE}}` where the post should mention the business. Keep `{{TOPIC}}`, `{{LOCATION}}`, and `{{DATE}}` as they are; they are filled in at run time.
- If posts are separate files, replace the "add to the data file" steps with "create a new file" steps.

### Reference template

{{DEFAULT_BLOG_PROMPT}}
