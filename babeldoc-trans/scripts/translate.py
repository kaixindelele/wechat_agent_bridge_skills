#!/usr/bin/env python3
"""BabelDOC 论文翻译封装脚本.

用法:
    python translate.py <arxiv_url_or_pdf_path> [--output-dir DIR] [--pages PAGES]

输入:
    - arxiv URL   (https://arxiv.org/abs/xxxx / https://arxiv.org/pdf/xxxx)
    - arxiv ID    (xxxx.xxxxx)
    - 本地 PDF 路径

输出:
    <output-dir>/<论文中文标题>.pdf  （babeldoc 单语中文译文）

环境变量:
    BABELDOC_API_KEY  — OpenAI 兼容 API key（必须设置）
    BABELDOC_API_BASE — API base URL（默认 https://api.bltcy.ai/v1）
    BABELDOC_MODEL    — 模型名（默认 gpt-4o-mini）
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

DEFAULT_API_KEY = os.environ.get("BABELDOC_API_KEY", "")
DEFAULT_API_BASE = os.environ.get("BABELDOC_API_BASE", "https://api.bltcy.ai/v1")
DEFAULT_MODEL = os.environ.get("BABELDOC_MODEL", "gpt-4o-mini")


# ---------- 输入处理 ----------

ARXIV_ID_RE = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?")


def resolve_input(src: str, workdir: Path) -> Path:
    """把输入 (URL / arxiv ID / 本地路径) 解析成本地 PDF 路径."""
    src = src.strip()

    if src.lower().endswith(".pdf") and Path(src).exists():
        return Path(src).resolve()

    if src.startswith(("http://", "https://")):
        arxiv_match = ARXIV_ID_RE.search(src)
        if "arxiv.org" in src and arxiv_match:
            arxiv_id = arxiv_match.group(1)
            url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        else:
            url = src
        out = workdir / "paper.pdf"
        _download(url, out)
        return out

    if ARXIV_ID_RE.fullmatch(src):
        arxiv_id = ARXIV_ID_RE.fullmatch(src).group(1)
        out = workdir / "paper.pdf"
        _download(f"https://arxiv.org/pdf/{arxiv_id}.pdf", out)
        return out

    raise SystemExit(f"无法识别的输入: {src}")


def _download(url: str, out: Path) -> None:
    print(f"[DOWNLOAD] {url} -> {out}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(out, "wb") as f:
        shutil.copyfileobj(r, f)
    print(f"[DOWNLOAD] Done, {out.stat().st_size // 1024}KB", flush=True)


# ---------- 标题提取 & 翻译 ----------


def extract_title(pdf: Path) -> str:
    """从 PDF 第一页按最大字号提取标题文本."""
    import pymupdf

    doc = pymupdf.open(pdf)
    meta_title = (doc.metadata or {}).get("title", "") or ""
    meta_title = meta_title.strip()

    candidate = ""
    try:
        page = doc[0]
        blocks = page.get_text("dict")["blocks"]
        spans = []
        for b in blocks:
            if b.get("type") != 0:
                continue
            for line in b.get("lines", []):
                for sp in line.get("spans", []):
                    txt = (sp.get("text") or "").strip()
                    if len(txt) < 3:
                        continue
                    spans.append((sp.get("size", 0), sp.get("bbox", [0, 0, 0, 0])[1], txt))
        if spans:
            max_size = max(s[0] for s in spans)
            top_spans = [s for s in spans if s[0] >= max_size - 0.1]
            top_spans.sort(key=lambda x: x[1])
            top_y = top_spans[0][1]
            title_parts = [s[2] for s in top_spans if abs(s[1] - top_y) < max_size * 3]
            candidate = " ".join(title_parts).strip()
    finally:
        doc.close()

    if len(candidate) >= 6 and not candidate.lower().startswith("arxiv"):
        return candidate
    if len(meta_title) >= 6:
        return meta_title
    return candidate or meta_title or "paper"


def translate_title(title_en: str, api_key: str, api_base: str, model: str) -> str:
    """用 LLM 将英文标题翻译成简体中文，返回干净的中文字符串."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=api_base)
    prompt = (
        "请将下面这篇英文学术论文标题翻译成简洁准确的简体中文标题。\n"
        "要求：\n"
        "1. 只输出中文标题本身，不要任何额外文字、引号、前后缀、解释\n"
        "2. 保留 LaTeX 术语/模型名/专有名词的英文原文（如 Transformer, ViT, GPT-4）\n"
        "3. 不超过 40 个字\n\n"
        f"英文标题：{title_en}\n\n"
        "中文标题："
    )
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=120,
        )
        zh = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        print(f"[WARN] 标题翻译失败: {e}", flush=True)
        return title_en

    zh = zh.strip().strip('"').strip("'").strip("\u300a\u300b").strip()
    zh = zh.split("\n")[0].strip()
    return zh or title_en


# ---------- 文件名清理 ----------

INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_filename(name: str, maxlen: int = 80) -> str:
    name = INVALID_CHARS.sub("", name).strip().strip(".")
    name = re.sub(r"\s+", " ", name)
    if len(name) > maxlen:
        name = name[:maxlen].rstrip()
    return name or "paper"


# ---------- 调用 babeldoc ----------


def run_babeldoc(
    pdf: Path,
    work_out: Path,
    api_key: str,
    api_base: str,
    model: str,
    pages: str | None,
    qps: int,
    dual: bool,
) -> Path:
    work_out.mkdir(parents=True, exist_ok=True)
    cmd = [
        "babeldoc",
        "--files", str(pdf),
        "--openai",
        "--openai-model", model,
        "--openai-base-url", api_base,
        "--openai-api-key", api_key,
        "--output", str(work_out),
        "--qps", str(qps),
        "--skip-scanned-detection",
        "--no-auto-extract-glossary",
        "--watermark-output-mode", "no_watermark",
    ]
    if not dual:
        cmd.append("--no-dual")
    if pages:
        cmd.extend(["--pages", pages])

    print(f"[BABELDOC] 开始翻译 {pdf.name} ...", flush=True)
    proc = subprocess.run(cmd, check=False)
    if proc.returncode != 0:
        raise SystemExit(f"babeldoc 执行失败，退出码 {proc.returncode}")

    mono = sorted(work_out.glob("*.zh.mono.pdf"), key=lambda p: p.stat().st_mtime)
    if not mono:
        raise SystemExit(f"未找到 babeldoc 输出的 *.zh.mono.pdf (目录: {work_out})")
    return mono[-1]


# ---------- 主流程 ----------


def main() -> None:
    ap = argparse.ArgumentParser(description="BabelDOC 论文翻译 + 中文标题重命名")
    ap.add_argument("source", help="arxiv URL / arxiv ID / 本地 PDF 路径")
    ap.add_argument("--output-dir", default="/tmp/babeldoc_output", help="最终 PDF 输出目录")
    ap.add_argument("--pages", default=None, help='仅翻译指定页，如 "1-5" 或 "1,2,5-"')
    ap.add_argument("--qps", type=int, default=8, help="翻译 QPS")
    ap.add_argument("--dual", action="store_true", help="同时输出双语 PDF")
    ap.add_argument("--api-key", default=DEFAULT_API_KEY)
    ap.add_argument("--api-base", default=DEFAULT_API_BASE)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    args = ap.parse_args()

    if not args.api_key:
        print("错误: 未设置 API key。请设置环境变量 BABELDOC_API_KEY 或通过 --api-key 传入。", file=sys.stderr)
        print("  export BABELDOC_API_KEY=sk-your-key-here", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="babeldoc_") as tmp:
        tmp_dir = Path(tmp)
        pdf = resolve_input(args.source, tmp_dir)
        print(f"[INPUT] PDF: {pdf}", flush=True)

        title_en = extract_title(pdf)
        print(f"[TITLE-EN] {title_en}", flush=True)
        title_zh = translate_title(title_en, args.api_key, args.api_base, args.model)
        print(f"[TITLE-ZH] {title_zh}", flush=True)

        safe_name = sanitize_filename(title_zh)

        bd_out = tmp_dir / "babeldoc_out"
        mono_pdf = run_babeldoc(
            pdf=pdf,
            work_out=bd_out,
            api_key=args.api_key,
            api_base=args.api_base,
            model=args.model,
            pages=args.pages,
            qps=args.qps,
            dual=args.dual,
        )

        final_pdf = out_dir / f"{safe_name}.pdf"
        if final_pdf.exists():
            final_pdf = out_dir / f"{safe_name}_{os.getpid()}.pdf"
        shutil.copy2(mono_pdf, final_pdf)

        dual_final = None
        if args.dual:
            dual_list = sorted(bd_out.glob("*.zh.dual.pdf"), key=lambda p: p.stat().st_mtime)
            if dual_list:
                dual_final = out_dir / f"{safe_name}_双语.pdf"
                shutil.copy2(dual_list[-1], dual_final)

    result = {
        "title_en": title_en,
        "title_zh": title_zh,
        "output_pdf": str(final_pdf),
        "output_dual_pdf": str(dual_final) if dual_final else None,
        "size_kb": final_pdf.stat().st_size // 1024,
    }
    print("[DONE]", json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
