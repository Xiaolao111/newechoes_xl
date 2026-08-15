#!/usr/bin/env bash
# 从 Obsidian 同步《高数公式》到博客，并一键部署上线
# - 保留博客侧 YAML frontmatter（title/date/tags）
# - 用 Obsidian 正文覆盖 frontmatter 之后的内容
#
# 用法：
#   ./scripts/publish-gaoshu.sh
#   npm run publish:gaoshu

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SRC="${GAOSHU_SRC:-/Users/xiaolao/obsidian/work_and_study/考研/数学/高数公式.md}"
DEST="${GAOSHU_DEST:-$ROOT_DIR/src/content/考研专业课/高数公式.md}"

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -f "$SRC" ]] || die "找不到 Obsidian 源文件：$SRC"
mkdir -p "$(dirname "$DEST")"

DEFAULT_FRONTMATTER=$(cat <<'EOF'
---
title: 高数笔记
date: 2026-08-10T13:15:22+08:00
tags:
  - 高数
---
EOF
)

log "同步高数公式（保留博客 frontmatter）"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ -f "$DEST" ]] && head -n 1 "$DEST" | grep -qx -- '---'; then
  # 取出已有 frontmatter（含首尾 ---）
  awk '
    BEGIN { in_fm=0; done=0 }
    done { next }
    NR==1 && $0=="---" { in_fm=1; print; next }
    in_fm && $0=="---" { print; done=1; next }
    in_fm { print }
  ' "$DEST" > "$TMP"
else
  printf '%s\n' "$DEFAULT_FRONTMATTER" > "$TMP"
fi

# Obsidian 正文：若自身带 frontmatter 则跳过
if head -n 1 "$SRC" | grep -qx -- '---'; then
  awk '
    BEGIN { in_fm=0; started=0 }
    !started && NR==1 && $0=="---" { in_fm=1; next }
    in_fm && $0=="---" { in_fm=0; started=1; next }
    in_fm { next }
    { print }
  ' "$SRC" >> "$TMP"
else
  cat "$SRC" >> "$TMP"
fi

cp -f "$TMP" "$DEST"

printf '已更新：%s (%s bytes)\n' "$DEST" "$(wc -c < "$DEST" | tr -d ' ')"

log "开始部署网站"
exec bash "$ROOT_DIR/scripts/deploy.sh"
