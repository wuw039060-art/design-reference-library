# Aesthetic Reference Library

面向黑客松展示的网页与 PPT 审美参考库。它把优秀网页、产品页、作品集、投资金融页面和演示稿拆成可复用的设计参考包，并给 AI 代理提供清晰的分类、风格标签、适用场景和兼容性规则。

> 公开仓库只包含 GitHub 友好的展示版与元数据摘要。完整素材包、高清视频、原始采集证据和本地自动化配置不会提交。

## Demo

- GitHub Pages 入口：`docs/index.html`
- 公开摘要数据：`docs/library-summary.json`
- 本地完整入口：`output/审美素材库/index.html`（不提交到 GitHub）

## What It Shows

- 56 个精选网页/PPT 参考条目
- 多类别筛选：商业网站、产品应用、个人网站、电商消费、投资金融、组织公益、工业制造、PPT 模板等
- 每个条目包含用途、风格标签、适合场景、来源链接和预览图
- 兼容性规则用于约束字体、布局、背景和动效组合，减少“拼贴感”和风格冲突
- 面向 AI 代理的复现说明，帮助从参考库生成更稳定的网页/PPT 设计

## Repository Layout

```text
docs/
  index.html                # GitHub Pages 展示页
  library-summary.json      # 已脱敏的公开摘要
  assets/previews/          # 少量轻量预览图
scripts/
  prepare_github_demo.mjs   # 从本地完整库生成公开展示版
  cleanup_after_task.ps1    # 任务结束清理脚本
  audit_*.mjs               # 本地完整库审计脚本
  build_*.mjs               # 本地完整库构建脚本
output/
  .gitkeep                  # 完整素材库目录占位；大文件被 .gitignore 排除
```

## Privacy And Size Policy

这个仓库适合公开提交，因为它刻意排除了：

- 本机用户名、盘符路径、Codex 会话路径和通知脚本路径
- 完整素材包 zip、视频、原始截图采集目录和浏览器缓存
- 任何密钥、令牌、通知地址或个人自动化配置

完整本地库约 7GB，其中部分单文件超过 GitHub 100MB 限制，所以不要提交 `output/审美素材库/`。

## Generate The Public Demo

```powershell
node .\scripts\prepare_github_demo.mjs
.\scripts\cleanup_after_task.ps1 -DryRun
```

`prepare_github_demo.mjs` 会从本地完整库读取 `library-index.json`，复制少量预览图到 `docs/assets/previews/`，并生成公开版 `docs/index.html` 和 `docs/library-summary.json`。

## How To Submit To GitHub

完整步骤也整理在 `SUBMISSION_CHECKLIST.md`。

1. 先确认不会提交大文件：

```powershell
git status --short
git check-ignore -v output/审美素材库/index.html
```

2. 检查 100MB 以上文件是否仍会被加入仓库：

```powershell
git ls-files -o --exclude-standard | ForEach-Object { Get-Item -LiteralPath $_ } | Where-Object Length -gt 100MB
```

这条命令没有输出才继续。

3. 提交 GitHub 展示版：

```powershell
git add README.md AGENTS.md .gitignore docs scripts output/.gitkeep
git commit -m "Prepare GitHub demo for aesthetic reference library"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

如果已经有远程仓库，把 `remote add` 换成：

```powershell
git remote set-url origin https://github.com/<your-user>/<your-repo>.git
```

4. GitHub Pages 展示：

在 GitHub 仓库页面进入 `Settings` -> `Pages`，选择 `Deploy from a branch`，分支选 `main`，目录选 `/docs`。

## Hackathon Pitch

这个项目展示的是一个“可被 AI 代理读取和执行的审美资料库”：不是简单收藏截图，而是把真实网页/PPT 的视觉证据、分类标签、适用场景和组合约束整理成结构化素材。它可以帮助后续网页生成、PPT 生成和品牌页面设计任务更稳定地复用高质量参考，降低随机拼贴和风格跑偏。
