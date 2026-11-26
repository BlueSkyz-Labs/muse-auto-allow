# Projections (PDC 1.0)

This folder holds the data this repository publishes to the Owner portal, BlueSkyz Zenith.
Standard: sgps-core `standards/portfolio/PORTFOLIO_DATA_CONTRACT.md`. Zenith pulls this folder
itself (read-only token, 09:40 and 17:40 GMT+7); nothing here pushes to another repository.

- One JSON file per projection, named after what it shows (`usage-summary.json`, `deploy.json`, ...).
- Each file carries `schema_version`, `kind`, `project_id`, `line` (APP / MEDIA / GAME / PORTFOLIO),
  `source.repository`, `as_of` and `stale_after`.
- Counts, percentages and state tokens only. No money, names, emails, prompts, thread names or keys.
- Unmeasured is `NOT_VERIFIED` with `value: null`, never 0.
- Before a commit that changes this folder:

  ```bash
  python3 $SGPS_CORE/tools/sgps_projection.py validate docs/projections
  ```

  A failure stops the publish and is reported to the Owner (DEC-061).
- Prefer a GitHub Actions or Workers Builds step to an agent session for producing these files.

| File | Kind | Built by | Refresh |
|---|---|---|---|
| _(none yet)_ | | | |
