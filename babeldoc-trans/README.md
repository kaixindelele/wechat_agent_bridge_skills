# babeldoc-trans

PDF 论文自动翻译 Skill，基于 [BabelDOC](https://github.com/funstory-ai/BabelDOC) 引擎。

## 功能

- 支持 arxiv URL / arxiv ID / 本地 PDF 作为输入
- 智能版式分析，保留原始排版（图表、公式、图片位置不变）
- 公式保护，不破坏数学公式
- 自动提取论文标题并翻译为中文作为文件名
- 可选双语对照输出

## 一键安装

```bash
# 1. 将此文件夹复制到 skill 目录
cp -r babeldoc-trans/ ~/.codebuddy/skills/babeldoc-trans/
# 或
cp -r babeldoc-trans/ ~/.claude/skills/babeldoc-trans/

# 2. 安装依赖
bash ~/.codebuddy/skills/babeldoc-trans/scripts/setup.sh

# 3. 配置 API Key
export BABELDOC_API_KEY=sk-your-api-key-here
```

## 快速开始

安装完成后，在 AI 对话中直接发送 arxiv 链接即可自动触发翻译：

```
https://arxiv.org/abs/2412.13211
```

或手动调用：

```bash
python ~/.codebuddy/skills/babeldoc-trans/scripts/translate.py https://arxiv.org/abs/2412.13211
```

## 环境变量

| 变量 | 说明 | 必须 |
|------|------|------|
| `BABELDOC_API_KEY` | OpenAI 兼容 API key | 是 |
| `BABELDOC_API_BASE` | API base URL（默认 `https://api.bltcy.ai/v1`） | 否 |
| `BABELDOC_MODEL` | 模型名（默认 `gpt-4o-mini`） | 否 |

## 依赖

- Python 3.10+
- babeldoc
- pymupdf
- openai
- opencv-python-headless

## 文件结构

```
babeldoc-trans/
├── SKILL.md              # AI 触发指令
├── README.md             # 本文件
├── scripts/
│   ├── setup.sh          # 一键安装依赖
│   └── translate.py      # 翻译执行脚本
└── references/
    └── usage_guide.md    # 详细参数与排查指南
```

## 许可

MIT
