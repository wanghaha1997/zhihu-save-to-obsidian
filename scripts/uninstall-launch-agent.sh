#!/usr/bin/env bash
set -euo pipefail

LABEL="com.wanghaha1997.zhihu-save-to-obsidian"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
USER_DOMAIN="gui/$(id -u)"

launchctl bootout "${USER_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"

echo "已卸载开机自启服务：${LABEL}"
