#!/usr/bin/env bash
# Atoms Demo · SQLite 备份脚本（Linux，配合 cron 使用）
#
# 用法：
#   chmod +x deploy/backup.sh
#   crontab -e
#   0 3 * * * /opt/atoms-demo/deploy/backup.sh >> /var/log/atoms-backup.log 2>&1
#
# 说明：用 sqlite3 的 .backup 做一致性快照，比直接 cp 更安全
#      （WAL 模式下直接复制可能拿到不一致的文件）。没装 sqlite3 时自动退回 cp 并提示。

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/atoms-demo}"
DB_FILE="${DB_FILE:-$APP_DIR/data/atoms.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/atoms-demo}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "[$(date '+%F %T')] 找不到数据库文件：$DB_FILE"
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/atoms-$STAMP.db'"
else
  echo "[$(date '+%F %T')] 未安装 sqlite3，退回直接复制（写入期间可能不一致，建议安装 sqlite3）"
  cp "$DB_FILE" "$BACKUP_DIR/atoms-$STAMP.db"
fi

gzip -f "$BACKUP_DIR/atoms-$STAMP.db"
echo "[$(date '+%F %T')] 已备份：$BACKUP_DIR/atoms-$STAMP.db.gz"

find "$BACKUP_DIR" -name 'atoms-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] 已清理超过 $KEEP_DAYS 天的旧备份"
