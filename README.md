# Aesthetic Reference Library

一个给 AI 设计代理使用的网页/PPT 审美参考库。

这个项目的初衷不是做一个“好看网站收藏夹”，而是解决 AI 做设计时最常见的断层：AI 可以写代码、可以排版、可以生成页面，但它经常不知道什么是真正成熟的网页审美，也不知道不同字体、布局、背景、动效为什么能搭在一起。结果就是生成出来的东西很容易变成模板感、卡片堆、渐变堆，或者看起来每次都像不同产品。

所以这个库想做的是：把真实优秀网页和演示稿拆成 AI 能理解、能检索、能复用的设计参考系统。它把“审美”从一句模糊提示，变成结构化的案例、标签、截图、来源、适用场景和兼容性规则。

## Why I Built It

我希望后续让 AI 做网页、PPT、产品页、作品集、品牌页时，不只是告诉它“做得高级一点”“参考 Apple 风格”“科技感一点”。这些话太模糊，模型很容易自由发挥，最后生成结果不可控。

更理想的方式是：

1. 先有一批真实、优秀、可观察的设计样本。
2. 每个样本都说明它适合什么场景，比如 SaaS、硬件产品、电商、投资机构、个人作品集、公益组织或路演 PPT。
3. 每个样本都有明确的风格标签，比如真实产品媒体、编辑式留白、强品牌 Hero、克制动效、界面画布、机构感排版。
4. 字体、布局、背景和动效不能随便混，要有兼容规则。
5. AI 代理可以直接读取这些资料，再根据任务选择合适参考，而不是凭空猜。

也就是说，这个项目本质上是在给 AI 建一个“设计参考记忆库”和“审美约束层”。

## The Problem

AI 生成界面时常见的问题：

- 风格不稳定，同一个需求每次生成都像不同产品
- 只会堆卡片、渐变和装饰元素，缺少真实网页的层次、节奏和留白
- 参考图只能“看起来像”，但没有被整理成可复用的数据
- 字体、布局、背景、动效随意混搭，最后变成不协调的拼贴
- 代理很难判断一个参考适合 SaaS、消费品牌、投资机构还是作品集
- 生成代码能跑，但视觉判断没有稳定依据

## The Solution

这个项目把高质量网页/PPT 拆成机器可读的参考库，让后续生成任务可以按“用途 + 风格 + 约束”来复用设计语言。

它做了三件事：

1. **收集真实参考**：保留来源链接、预览图和案例分类，而不是凭空生成风格。
2. **结构化审美信息**：把每个案例拆成分类、风格标签、适用场景和说明。
3. **加入兼容性规则**：约束字体、布局、背景和动效的组合，减少随机拼贴。

## What It Contains

- 56 个网页/PPT 设计参考
- 8 类设计场景：产品应用、商业网站、个人网站、电商消费、投资金融、组织公益、媒体娱乐、PPT 模板
- 每个条目的来源链接、分类、风格标签、适用场景和预览图
- 面向 AI 代理的素材库构建脚本
- 本地完整库审计脚本
- GitHub Pages 公开展示版本

## What It Can Be Used For

- 给 AI 网页生成任务提供稳定视觉参考
- 给 PPT/路演稿生成任务提供风格方向
- 给产品页、SaaS 官网、个人作品集、品牌页提供可复用案例
- 帮助代理选择“这个项目应该参考哪类设计”
- 避免不同审美元素乱混，比如把金融机构风格、消费品牌风格和作品集风格硬拼在一起
- 作为后续设计生成系统的数据层

## Public Demo

- 展示页：[docs/index.html](docs/index.html)
- 公开摘要：[docs/library-summary.json](docs/library-summary.json)
- 预览图：[docs/assets/previews](docs/assets/previews)

## Code You Can Read

核心代码都在仓库里，可以直接点开看：

- [scripts/prepare_github_demo.mjs](scripts/prepare_github_demo.mjs)：从完整本地库生成公开 Demo
- [scripts/build_public_library_platform_20260713.mjs](scripts/build_public_library_platform_20260713.mjs)：生成完整素材库平台
- [scripts/audit_library.mjs](scripts/audit_library.mjs)：检查素材包基础完整性
- [scripts/audit_full_reproduction_library_20260713.mjs](scripts/audit_full_reproduction_library_20260713.mjs)：检查完整复现资料
- [scripts/reconcile_local_asset_manifests_20260716.mjs](scripts/reconcile_local_asset_manifests_20260716.mjs)：核对本地素材清单
- [scripts/cleanup_after_task.ps1](scripts/cleanup_after_task.ps1)：任务结束后清理临时产物

## How It Works

1. 本地完整库保存大素材、截图、录屏、分析文件和素材包。
2. 完整库入口维护 `library-index.json`，记录每个设计案例的元数据。
3. `prepare_github_demo.mjs` 读取完整库，复制少量预览图，生成公开版 `docs/index.html` 和 `docs/library-summary.json`。
4. GitHub 仓库展示轻量 Demo 和可读代码，完整素材包不进入公开仓库。
5. 后续 AI 代理可以读取这些结构化数据，按任务类型选择参考和约束。

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

如果把普通提示词看成一句临时要求，这个项目更像一个可持续扩展的审美资料层：它让 AI 不只是会写页面，而是能在生成前先理解“应该参考什么、为什么适合、哪些元素不能乱混”。

## Public Repository Note

公开仓库只包含 Demo、摘要数据和代码。完整素材包、视频、原始采集文件和本地自动化配置不提交，避免仓库过大，也避免公开无关的本地环境信息。
