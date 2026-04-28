# babeldoc-trans 使用指南

## 完整参数列表

### translate.py 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `source` | 输入源（必填）：arxiv URL / arxiv ID / 本地 PDF 路径 | - |
| `--output-dir` | 翻译后 PDF 输出目录 | `/tmp/babeldoc_output` |
| `--pages` | 只翻译指定页，如 `1-5`、`1,3,5-` | 全部页面 |
| `--qps` | 翻译 API 并发 QPS | `8` |
| `--dual` | 额外输出双语对照 PDF | 关闭 |
| `--model` | OpenAI 兼容模型名 | `gpt-4o-mini` |
| `--api-base` | OpenAI 兼容 API base URL | `https://api.bltcy.ai/v1` |
| `--api-key` | API key | 读取 `$BABELDOC_API_KEY` |

### 环境变量

| 变量 | 说明 | 必须 |
|------|------|------|
| `BABELDOC_API_KEY` | OpenAI 兼容 API key | 是 |
| `BABELDOC_API_BASE` | API base URL | 否（默认 `https://api.bltcy.ai/v1`） |
| `BABELDOC_MODEL` | 模型名 | 否（默认 `gpt-4o-mini`） |

配置方式：
```bash
# 加入 ~/.bashrc 或 ~/.zshrc
export BABELDOC_API_KEY=sk-your-api-key-here
export BABELDOC_API_BASE=https://api.bltcy.ai/v1
export BABELDOC_MODEL=gpt-4o-mini
```

## 使用示例

```bash
# 翻译 arxiv 论文（最常用）
python scripts/translate.py https://arxiv.org/abs/2412.13211

# 用 arxiv ID
python scripts/translate.py 2412.13211

# 翻译本地 PDF
python scripts/translate.py /path/to/paper.pdf

# 指定输出目录 + 双语版
python scripts/translate.py 2412.13211 --output-dir ~/papers_zh --dual

# 只翻译前 5 页（快速预览）
python scripts/translate.py paper.pdf --pages 1-5

# 提高并发加速
python scripts/translate.py 2412.13211 --qps 15
```

## BabelDOC 核心优势

| 特性 | 说明 |
|------|------|
| 智能版式分析 | DocLayout 模型自动识别文本/图片/表格/公式区域 |
| 公式保护 | 自动检测并跳过数学公式，不破坏公式排版 |
| 术语自动提取 | 翻译前自动提取专业术语，保证术语一致性 |
| 富文本翻译 | 保留粗体/斜体/颜色等文本样式 |
| 字体子集化 | 自动嵌入中文字体子集，文件体积小 |
| 翻译缓存 | 相同内容不重复翻译，节省 token |
| 中文标题重命名 | 自动提取论文标题并翻译为中文作为文件名 |

## 性能参考

| 论文页数 | 耗时（qps=8） | Token 消耗（gpt-4o-mini） |
|----------|---------------|---------------------------|
| 2 页 | ~30 秒 | ~17k tokens |
| 10 页 | ~1-2 分钟 | ~80k tokens |
| 30 页 | ~3-6 分钟 | ~250k tokens |
| 46 页 | ~5-8 分钟 | ~400k tokens |

提高 `--qps` 可加速，但需注意 API 限额。

## 常见问题

### Q: 翻译速度太慢？
提高 `--qps` 参数（默认 8），如 `--qps 15`。但要注意不要超过 API 速率限制。

### Q: 中文标题出现特殊字符导致文件名异常？
脚本已过滤 `<>:"/\|?*` 等非法字符并限制长度 80 字。

### Q: 标题识别不准？
脚本按「第一页最大字号 + 最靠顶部」启发式识别。如果识别到噪声（如 "arxiv:xxxx"）会 fallback 到 PDF metadata.title。实在不行手动改名即可。

### Q: API 限流报错？
降低 `--qps` 参数，如 `--qps 3`。

### Q: 首次运行很慢？
首次运行会下载 DocLayout 模型（约 100MB），后续有缓存。

### Q: 如何只输出双语对照版？
加 `--dual` 参数，会同时输出纯中文版和双语对照版。

### Q: 如何换 API 提供商？
设置环境变量：
```bash
export BABELDOC_API_KEY=sk-your-openai-key
export BABELDOC_API_BASE=https://api.openai.com/v1
export BABELDOC_MODEL=gpt-4o-mini
```

## 依赖

| 包名 | 用途 | 安装命令 |
|------|------|---------|
| babeldoc | PDF 翻译引擎 | `pip install babeldoc` |
| pymupdf | PDF 标题提取 | `pip install pymupdf` |
| openai | LLM 标题翻译 | `pip install openai` |
| opencv-python-headless | babeldoc 图像处理依赖 | `pip install opencv-python-headless` |

一键安装：`bash scripts/setup.sh`
