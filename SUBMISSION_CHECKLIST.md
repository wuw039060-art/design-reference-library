# GitHub Submission Checklist

## Before Commit

Run these checks from the repository root:

```powershell
node .\scripts\prepare_github_demo.mjs
.\scripts\cleanup_after_task.ps1 -DryRun
git status --short --ignored
git check-ignore -v output/审美素材库/index.html
git ls-files -o --exclude-standard | ForEach-Object { Get-Item -LiteralPath $_ } | Where-Object Length -gt 100MB
```

Continue only when:

- `output/审美素材库/index.html` is ignored by `.gitignore`
- the 100MB check prints nothing
- `docs/` contains the public demo files
- no local machine paths, usernames, notification scripts, tokens, or private automation details appear in public files

## Files To Commit

```powershell
git add README.md SUBMISSION_CHECKLIST.md AGENTS.md .gitignore docs scripts output/.gitkeep
git commit -m "Prepare GitHub demo for aesthetic reference library"
```

## Push

For a new repository:

```powershell
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

For an existing repository:

```powershell
git remote set-url origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## GitHub Pages

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Set source to `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/docs`.

## Do Not Commit

- `output/审美素材库/`
- `output/候选审核/`
- full-size zip packs
- videos, raw capture folders, browser caches
- local paths such as drive letters or user folders
- notification scripts, tokens, passwords, API keys, private config
