# Blog Writer Action

A GitHub Action that generates SEO-optimized blog posts using Claude Code CLI. Configure it with a simple JSON file and let it run on a schedule or on-demand.

## Quick Start

### 1. Add a config file

Create `blog.config.json` in your repo root:

```json
{
  "promptTemplatePath": ".github/prompts/generate-blog-post.md",
  "placeholders": {
    "COMPANY_NAME": "Your Company",
    "PHONE": "(555) 123-4567"
  },
  "topicSchedule": {
    "1": "topic-a",
    "2": "topic-b",
    "3": "topic-c",
    "4": "topic-d",
    "5": "topic-a"
  },
  "locations": ["City A", "City B", "City C"],
  "postCountCommand": "grep -c 'slug:' src/data/posts.ts || echo 0",
  "claude": {
    "allowedTools": "Read,Edit,Glob,Grep",
    "maxTurns": 25
  },
  "validationCommand": "node scripts/fix-blog-backticks.js",
  "buildCommand": "npm run build",
  "filesToCommit": ["src/data/posts.ts"],
  "commitMessage": "feat(blog): add post - {topic} ({location})"
}
```

### 2. Add a workflow

Create `.github/workflows/daily-blog-post.yml`:

```yaml
name: Daily Blog Post
on:
  schedule:
    - cron: '0 8 * * 1-5'
  workflow_dispatch:
    inputs:
      topic:
        description: 'Topic override'
        required: false
      location:
        description: 'Location override'
        required: false

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - uses: dephyned/blog-writer-action@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          topic: ${{ inputs.topic || '' }}
          location: ${{ inputs.location || '' }}
```

### 3. Add your API key

Add `ANTHROPIC_API_KEY` to your repo secrets (Settings > Secrets and variables > Actions).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `anthropic-api-key` | yes | — | Anthropic API key for Claude Code CLI |
| `config-path` | no | `blog.config.json` | Path to config file |
| `topic` | no | `''` | Manual topic override |
| `location` | no | `''` | Manual location override |
| `auto-commit` | no | `'true'` | Auto commit and push changes |
| `commit-push-branch` | no | `'main'` | Branch to push to |
| `install-dependencies` | no | `'true'` | Run `npm ci` before generation |

## Outputs

| Output | Description |
|---|---|
| `topic` | The topic used |
| `location` | The location used |
| `date` | The date (YYYY-MM-DD) |
| `committed` | Whether changes were committed |
| `post-slug` | Generated post slug |
| `post-title` | Generated post title |

## Config Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `promptTemplatePath` | string | `.github/prompts/generate-blog-post.md` | Path to prompt template |
| `placeholders` | object | `{}` | Custom `{{KEY}}` placeholders for prompt |
| `topicSchedule` | object | `{}` | Day-of-week (0-6) to topic mapping |
| `locations` | string[] | `[]` | Locations to rotate through |
| `postCountCommand` | string | `echo 0` | Shell command to count existing posts |
| `claude.allowedTools` | string | `Read,Edit,Glob,Grep` | Tools Claude can use |
| `claude.maxTurns` | number | `15` | Max tool-call turns |
| `validationCommand` | string | `''` | Shell command to validate output |
| `buildCommand` | string | `''` | Shell command to build the project |
| `filesToCommit` | string[] | `[]` | Specific files to commit (empty = all) |
| `commitMessage` | string | `feat(blog): add blog post - {topic} ({location})` | Commit message template |

## Prompt Placeholders

Built-in placeholders (always available):
- `{{TOPIC}}` — resolved topic
- `{{LOCATION}}` — resolved location
- `{{DATE}}` — today's date (YYYY-MM-DD)

Custom placeholders defined in `placeholders` config field are also substituted.

## Topic Scheduling

Topics are selected by day of week (JavaScript `getDay()`):
- `0` = Sunday, `1` = Monday, ..., `6` = Saturday

## Location Rotation

Locations rotate based on post count: `postCount % locations.length`. The `postCountCommand` determines how many posts exist.

## Included Utilities

### fix-blog-backticks.js

Escapes backticks inside TypeScript template literal content fields. Use it in your `validationCommand`:

```json
{
  "validationCommand": "node node_modules/blog-writer-action/scripts/fix-blog-backticks.js src/data/blogPosts.ts"
}
```

Or copy it into your own `scripts/` directory.

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT
