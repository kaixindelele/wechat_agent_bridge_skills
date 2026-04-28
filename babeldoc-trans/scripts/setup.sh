#!/usr/bin/env bash
#
# setup.sh — babeldoc-trans skill 一键安装依赖
#
# 用法:
#   bash setup.sh
#
# 安装内容:
#   - babeldoc (PDF 翻译引擎)
#   - pymupdf  (PDF 标题提取)
#   - openai   (LLM 标题翻译)
#   - opencv-python-headless (babeldoc 依赖)

set -euo pipefail

echo "=============================="
echo " babeldoc-trans 依赖安装"
echo "=============================="
echo ""

# ---------- 检测 Python ----------
if ! command -v python3 &>/dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3.10+"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "  macOS: brew install python3"
    exit 1
fi

PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "检测到 Python ${PY_VER}"

PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
    echo "警告: Python 版本过低 (${PY_VER})，建议使用 Python 3.10+"
fi

# ---------- 安装依赖 ----------
echo ""
echo "==> 安装 Python 依赖..."
pip install -q babeldoc pymupdf openai opencv-python-headless 2>&1 | tail -5

# ---------- 验证安装 ----------
echo ""
echo "==> 验证安装..."

PASS=true

if command -v babeldoc &>/dev/null; then
    BD_VER=$(babeldoc --version 2>&1 | head -1 || echo "unknown")
    echo "  babeldoc: ${BD_VER}"
else
    echo "  babeldoc: 未找到（请检查 PATH）"
    PASS=false
fi

python3 -c "import pymupdf; print(f'  pymupdf: {pymupdf.__version__}')" 2>/dev/null || {
    echo "  pymupdf: 安装失败"
    PASS=false
}

python3 -c "import openai; print(f'  openai: {openai.__version__}')" 2>/dev/null || {
    echo "  openai: 安装失败"
    PASS=false
}

if [ "$PASS" = true ]; then
    echo ""
    echo "=============================="
    echo " 安装成功!"
    echo "=============================="
else
    echo ""
    echo "部分依赖安装失败，请检查上方输出。"
    exit 1
fi

# ---------- 环境变量提示 ----------
echo ""
echo "==> 配置 API Key"
if [ -n "${BABELDOC_API_KEY:-}" ]; then
    echo "  已检测到 BABELDOC_API_KEY 环境变量"
else
    echo "  请设置 API key 环境变量:"
    echo ""
    echo "    export BABELDOC_API_KEY=sk-your-api-key-here"
    echo ""
    echo "  可选环境变量:"
    echo "    export BABELDOC_API_BASE=https://api.bltcy.ai/v1   # API 地址"
    echo "    export BABELDOC_MODEL=gpt-4o-mini                  # 模型名"
    echo ""
    echo "  建议将以上配置加入 ~/.bashrc 或 ~/.zshrc"
fi

echo ""
echo "快速开始:"
echo "  python $(dirname "$0")/translate.py https://arxiv.org/abs/2412.13211"
