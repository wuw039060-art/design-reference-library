# Aesthetic Reference Library

一个给 AI 设计代理使用的网页/PPT 审美参考库。

它不是普通截图收藏夹，而是把优秀网页和演示稿整理成结构化参考：每个案例都有分类、风格标签、适用场景、来源链接、预览图和兼容性规则。目标是让 AI 在生成网页、PPT、品牌页或产品页时，不再只靠随机审美和泛化提示，而是能读取明确的设计参考和约束。

## It Solves

AI 生成界面时常见的问题：

- 风格不稳定，同一个需求每次生成都像不同产品
- 只会堆卡片、渐变和装饰元素，缺少真实网页的层次和节奏
- 参考图只能“看起来像”，但没有可复用的分类、标签和组合规则
- 字体、布局、背景、动效随意混搭，最后变成不协调的拼贴

这个项目把高质量网页/PPT 拆成机器可读的参考库，让后续生成任务可以按“用途 + 风格 + 约束”来复用设计语言。

## What It Does

- 收集并整理 56 个网页/PPT 设计参考
- 按产品应用、商业网站、个人网站、电商消费、投资金融、组织公益、PPT 模板等类别组织
- 为每个案例提供风格标签、适用场景、来源链接和预览图
- 用兼容性规则约束字体、布局、背景和动效组合
- 生成一个轻量公开 Demo，适合 GitHub Pages 展示

## Public Demo

- 展示页：[docs/index.html](docs/index.html)
- 公开摘要：[docs/library-summary.json](docs/library-summary.json)
- 预览图：[docs/assets/previews](docs/assets/previews)

## Code You Can Read

核心代码都在仓库里，可以直接点开看：

- [scripts/prepare_github_demo.mjs](scripts/prepare_github_demo.mjs)：从完整本地库生成公开 Demo
- [scripts/build_public_library_platform_20260713.mjs](scripts/build_public_library_platform_20260713.mjs)：生成完整素材库平台
- [scripts/audit_library.mjs](scripts/audit_library.mjs)：检查素材包基础完整性
- [scripts/reconcile_local_asset_manifests_20260716.mjs](scripts/reconcile_local_asset_manifests_20260716.mjs)：核对本地素材清单
- [scripts/cleanup_after_task.ps1](scripts/cleanup_after_task.ps1)：任务结束后清理临时产物

## How It Works

1. 本地完整库保存大素材、截图、录屏和分析文件。
2. `prepare_github_demo.mjs` 读取完整库的 `library-index.json`。
3. 脚本复制少量预览图并生成 `docs/index.html` 和 `docs/library-summary.json`。
4. GitHub 公开仓库只展示轻量 Demo 和可读代码，不提交大型素材包。

## Repository Layout

```text
docs/
  index.html                # GitHub Pages 展示页
  library-summary.json      # 公开摘要数据
  assets/previews/          # 轻量预览图
scripts/
  prepare_github_demo.mjs   # 公开 Demo 生成脚本
  build_public_*.mjs        # 完整平台构建脚本
  audit_*.mjs               # 本地素材库审计脚本
  cleanup_after_task.ps1    # 临时文件清理脚本
output/
  .gitkeep                  # 完整本地素材库的占位目录
```

## Hackathon Pitch

这个项目展示的是一个“可被 AI 代理读取的设计参考系统”。它把真实优秀网页/PPT 的视觉特征整理成结构化数据和规则，让 AI 生成设计时有明确参考、分类和约束，从而减少随机拼贴，提高网页和演示稿生成的一致性与可控性。

## Public Repository Note

公开仓库只包含 Demo、摘要数据和代码。完整素材包、视频、原始采集文件和本地自动化配置不提交，避免仓库过大，也避免公开无关的本地环境信息。
