#!/usr/bin/env bash
# 本机构建 → 同步 dist → 服务器生成搜索索引 → 重启 PM2
# 用法：
#   ./scripts/deploy.sh
#   DEPLOY_HOST=root@1.2.3.4 ./scripts/deploy.sh
#   npm run deploy

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_HOST="${DEPLOY_HOST:-root@101.133.136.185}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/xiaolao-blog}"
PM2_APP="${PM2_APP:-xiaolao-blog}"

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v npm >/dev/null || die "未找到 npm"
command -v rsync >/dev/null || die "未找到 rsync"
command -v ssh >/dev/null || die "未找到 ssh"

log "1/4 本机构建 (npm run build)"
npm run build
[[ -f dist/server/entry.mjs ]] || die "构建产物缺失：dist/server/entry.mjs"

log "2/4 同步 dist → ${DEPLOY_HOST}:${REMOTE_DIR}/dist/"
rsync -avz --delete \
  ./dist/ \
  "${DEPLOY_HOST}:${REMOTE_DIR}/dist/"

log "3/4 服务器生成搜索索引"
ssh "${DEPLOY_HOST}" bash -s -- "${REMOTE_DIR}" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
cd "$REMOTE_DIR"

INDEXER="src/assets/article-index/article-indexer-cli"
[[ -f "$INDEXER" ]] || {
  echo "ERROR: 服务器缺少 $INDEXER"
  echo "请先保证仓库源码在 $REMOTE_DIR（含 article-indexer-cli）"
  exit 1
}

chmod +x "$INDEXER"
./"$INDEXER" \
  --source dist/client \
  --output dist/client/index \
  --verbose

echo "索引文件："
ls -la dist/client/index/
REMOTE

log "4/4 重启 PM2 服务 (${PM2_APP})"
ssh "${DEPLOY_HOST}" "cd '${REMOTE_DIR}' && pm2 restart '${PM2_APP}' && pm2 status '${PM2_APP}'"

log "部署完成 → https://xiaolao.ink"
