# Workspace Hygiene

This workspace is an aesthetic reference library. Keep permanent library assets separate from task-time working files.

## Keep

- `output/审美素材库/index.html`
- `output/审美素材库/library-index.json`
- `output/审美素材库/element-library.json`
- `output/审美素材库/compatibility-rules.json`
- `output/审美素材库/网页模板/`
- `output/审美素材库/PPT模板/`
- `output/审美素材库/素材包下载/`
- Reusable build and audit scripts in `scripts/`

## Remove after each task

- Empty logs and background test logs
- Root-level capture staging folders such as `captures-*`
- One-off dated repair, backfill, recapture, and scratch scripts once their output has been imported and verified
- Temporary browser captures, caches, and generated test artifacts

## Required end-of-task cleanup

Before final handoff, run:

```powershell
.\scripts\cleanup_after_task.ps1
```

Use `-DryRun` first when the task created new capture or script folders whose status is unclear.
