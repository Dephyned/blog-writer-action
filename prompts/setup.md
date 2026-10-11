# Set Up the Blog Writer for This Repo

You are setting up an automated blog writer for this repository. A scheduled job will later use the files you write to add one SEO blog post per run. Your job right now is only to inspect the repo and write two files. Do not write any blog posts.

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

## Step 2: Decide What Kind of Repo This Is

- **Local service business**: the repo is a marketing website for a business that serves customers in physical areas (cleaning, repairs, landscaping, etc.). Posts target services in specific cities.
- **Software product**: the repo contains the code of an app or platform people use (routes, screens, features, settings), with the blog alongside it. Posts explain how to get things done in the product, based on what the code actually does.

Follow Step 3A or Step 3B, not both.

## Step 3A: Local Service Business

From the site's pages, components, constants, and README, find:

- The business name, phone number, and website domain
- The services it offers (these become topics, written as short kebab-case slugs like `window-cleaning`)
- The cities or areas it serves (these become locations)

Only use facts you actually find in the repo. If no service areas are listed, use the single city the business is based in.

Write `{{CONFIG_PATH}}` as valid JSON:

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
  "keywords": [],
  "postCountCommand": "<shell command that prints the number of existing posts>",
  "claude": { "allowedTools": "Read,Edit,Glob,Grep", "maxTurns": 25 },
  "buildCommand": "<the repo's build command, or empty string if none>",
  "filesToCommit": ["<file or folder that new posts are added to>"],
  "commitMessage": "feat(blog): add blog post - {topic} ({location})"
}
```

- Leave `"keywords": []` empty. The owner adds target search keywords there later; each post then uses the next unused one.
- `topicSchedule` keys are days of the week (0 = Sunday). Spread the main services across the week, weighting the most important service.

Then write `{{PROMPT_TEMPLATE_PATH}}` from the reference template at the end, adapted to this repo. Use `{{COMPANY_NAME}}`, `{{PHONE}}`, and `{{WEBSITE}}` where the post should mention the business, and keep `{{TOPIC}}`, `{{LOCATION}}`, and `{{DATE}}` as they are; they are filled in at run time.

## Step 3B: Software Product

From the README, package metadata, and app shell (title, navigation), find the product name and website. Do not try to learn every feature now: a separate job reads the code and writes a product brief at `{{PRODUCT_BRIEF_PATH}}` before each post.

Write `{{CONFIG_PATH}}` as valid JSON:

```json
{
  "promptTemplatePath": "{{PROMPT_TEMPLATE_PATH}}",
  "productBrief": {},
  "keywords": [],
  "placeholders": {
    "PRODUCT_NAME": "<product name>",
    "WEBSITE": "<domain, or empty string if none>"
  },
  "postCountCommand": "<shell command that prints the number of existing posts>",
  "claude": { "allowedTools": "Read,Edit,Glob,Grep", "maxTurns": 25 },
  "buildCommand": "<the repo's build command, or empty string if none>",
  "filesToCommit": ["<file or folder that new posts are added to>"],
  "commitMessage": "feat(blog): add blog post"
}
```

- `"productBrief": {}` turns on the product brief with its defaults. Leave it empty.
- Leave `"keywords": []` empty. The owner adds target search keywords there later; each post then uses the next unused one.
- Do not add `topicSchedule` or `locations`.

Then write `{{PROMPT_TEMPLATE_PATH}}`. Use the reference template at the end only for its structure (checking existing posts, inserting the post in the right format). Replace the topic and location parts with these instructions, keeping `{{PRODUCT_BRIEF_PATH}}` and `{{DATE}}` exactly as written:

- Read `{{PRODUCT_BRIEF_PATH}}` first. It describes what `{{PRODUCT_NAME}}` actually does.
- Pick one idea from its "Article ideas" section that no existing post covers, judging by the existing titles and slugs.
- Write a practical post a real user would search for, such as "The best way to do X" or "How to do Y", using the real steps, screen names and settings from the brief.
- Only describe features, steps, limits and pricing that appear in the brief. Never invent capabilities or compare against competitors by name.
- Use `{{DATE}}` as the publish date.

## Rules for Both

- `postCountCommand` must work from the repo root, e.g. `grep -c "slug:" src/data/blogPosts.ts || echo 0` or `ls content/blog/*.md | wc -l`.
- If posts are separate files, use `"Read,Write,Edit,Glob,Grep"` for `allowedTools` so new files can be created, put the posts folder in `filesToCommit`, and replace the "add to the data file" steps with "create a new file" steps.
- `buildCommand` should be the `build` script from `package.json` (e.g. `npm run build`) if one exists.
- In the prompt you write, name the exact file or folder posts go in and describe the exact post format you found (fields, date format, slug style), with a short skeleton of one post.

## Reference Template

{{DEFAULT_BLOG_PROMPT}}
