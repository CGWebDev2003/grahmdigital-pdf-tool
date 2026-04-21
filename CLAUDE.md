@AGENTS.md

# Changelog & Version Policy

**Every time you make code changes**, you MUST also:

1. **Update `lib/version.ts`** — bump `APP_VERSION` following semantic versioning:
   - Patch (`x.y.Z+1`): bug fixes, copy changes, minor style tweaks
   - Minor (`x.Y+1.0`): new features, non-breaking additions or changes
   - Major (`X+1.0.0`): breaking changes, full rewrites

2. **Add an entry to `CHANGELOG.md`** at the top of the list, using this format:
   ```
   ## [vX.Y.Z] - YYYY-MM-DD
   ### Added / Changed / Fixed / Removed
   - Short description of what changed and why
   ```
   Use today's date from the `currentDate` context variable.

The footer automatically reads from `lib/version.ts`, so no other files need to be updated for the version display.
