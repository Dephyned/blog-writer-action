# Fix the New Blog Post

You just added a blog post, and the site no longer builds. The site built fine without your post, so something in the post caused it.

## Post Files

{{POST_FILES}}

## End of the Build Output

```
{{BUILD_OUTPUT}}
```

## Your Task

Find the new post (it is the uncommitted change in the files above) and fix only that post so the site builds. Do not change existing posts or any other file.

Common causes: unescaped characters for the format (backticks inside template literals, `{` or `<` in MDX, quotes in JSON), invalid frontmatter, a missing or wrong field, a duplicate slug, or a reference to a component or image that does not exist.

Keep the post's content and meaning. Change only what the build needs.
