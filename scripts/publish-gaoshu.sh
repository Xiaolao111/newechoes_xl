#!/usr/bin/env bash
# 从 Obsidian 同步《考研资料》全部笔记到博客，并一键部署上线
# - 保留博客侧 YAML frontmatter（title/date/tags）
# - 用 Obsidian 正文覆盖 frontmatter 之后的内容
# - 同步笔记旁的图片到 public/images/考研资料/<笔记名>/
# - 把 Markdown 里的相对路径 / Wiki 图链改成 /images/...
# - 博客正文明显更长时默认跳过正文覆盖，但仍同步图片（FORCE=1 可强制覆盖正文）
#
# 用法：
#   ./scripts/publish-gaoshu.sh
#   ./scripts/publish-gaoshu.sh --sync-only
#   FORCE=1 ./scripts/publish-gaoshu.sh --sync-only
#   npm run publish:kaoyan
#   npm run publish:gaoshu

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OBSIDIAN_ROOT="${OBSIDIAN_ROOT:-/Users/xiaolao/obsidian/work_and_study/考研}"
DEST_DIR="${KAOYAN_DEST_DIR:-$ROOT_DIR/src/content/考研资料}"
PUBLIC_ROOT="${KAOYAN_PUBLIC_ROOT:-$ROOT_DIR/public/images}"
SYNC_SCRIPT="$ROOT_DIR/scripts/sync-kaoyan-note.py"
SYNC_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --sync-only|--no-deploy) SYNC_ONLY=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      printf 'ERROR: 未知参数：%s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

# dest_name|obsidian_relpath|title|comma,separated,tags
KAOYAN_NOTES=(
  "高数公式.md|数学/高数公式.md|高数笔记|高数"
  "自控理论与设计.md|控制工程/笔记/自控理论与设计.md|自控理论与设计|控制工程,自动控制理论"
)

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v python3 >/dev/null || die "未找到 python3"
[[ -f "$SYNC_SCRIPT" ]] || die "找不到同步脚本：$SYNC_SCRIPT"
[[ -d "$OBSIDIAN_ROOT" ]] || die "找不到 Obsidian 考研目录：$OBSIDIAN_ROOT"
mkdir -p "$DEST_DIR"

sync_one() {
  local dest_name="$1" src_rel="$2" title="$3" tags="$4"
  local src="$OBSIDIAN_ROOT/$src_rel"
  local dest="$DEST_DIR/$dest_name"
  local dest_rel_stem
  dest_rel_stem="$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).with_suffix("").as_posix())' "$dest_name")"

  [[ -f "$src" ]] || die "找不到 Obsidian 源文件：$src"

  python3 "$SYNC_SCRIPT" \
    "$src" \
    "$dest" \
    "$title" \
    "$tags" \
    "${FORCE:-}" \
    --vault-root "$OBSIDIAN_ROOT" \
    --public-root "$PUBLIC_ROOT" \
    --dest-rel-stem "考研资料/${dest_rel_stem}"
}

log "同步考研资料（正文 + 图片）"

skipped=0
updated=0
for spec in "${KAOYAN_NOTES[@]}"; do
  IFS='|' read -r dest_name src_rel title tags <<<"$spec"
  set +e
  output="$(sync_one "$dest_name" "$src_rel" "$title" "$tags" 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  if [[ "$status" -ne 0 ]]; then
    exit "$status"
  fi
  if printf '%s\n' "$output" | grep -q '跳过正文'; then
    skipped=$((skipped + 1))
  else
    updated=$((updated + 1))
  fi
done

printf '\n同步完成：更新 %s 篇，跳过正文 %s 篇（图片仍会同步）\n' "$updated" "$skipped"

if [[ "$SYNC_ONLY" -eq 1 ]]; then
  log "已跳过部署（--sync-only）"
  exit 0
fi

log "开始部署网站"
exec bash "$ROOT_DIR/scripts/deploy.sh"
