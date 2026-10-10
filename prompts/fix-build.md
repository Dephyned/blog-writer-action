# Fix the Blog Build Command

The blog writer checks that this site still builds after each new post. The build command in `{{CONFIG_PATH}}` fails even without a new post, so the command itself is wrong for this repo or for CI.

## The Failing Command

`{{BUILD_COMMAND}}`

## End of the Build Output

```
{{BUILD_OUTPUT}}
```

## Your Task

Work out why it fails, then edit only the `buildCommand` field in `{{CONFIG_PATH}}`. Do not change any other file or field.

Common causes and fixes:

- **Monorepo packages not built first** (e.g. "Module not found" for a workspace package like `@scope/shared`): build the app together with its dependencies. pnpm: `pnpm --filter <app>... build`. npm workspaces: build the dependency workspaces first, then the app. Turborepo: `npx turbo run build --filter=<app>...`.
- **Wrong package or path**: check `package.json` files and workspace config for the real app name and build script.
- **Needs secrets, a database, or services that CI does not have** (missing environment variables, connection errors, auth failures): there is no command that fixes this. Set `buildCommand` to `""`.
- **The repo's own code is broken** (type errors or syntax errors in files that are not blog posts): set `buildCommand` to `""`.

Only pick a new command if you can see from the repo's files why it will work. If you are unsure, set it to `""`.
