#!/usr/bin/env bash
set -euo pipefail

LABEL="com.wanghaha1997.zhihu-save-to-obsidian"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_PATH="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${PROJECT_DIR}/logs"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
USER_DOMAIN="gui/$(id -u)"

if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  echo "找不到可执行的 node，请先安装 Node.js。"
  exit 1
fi

mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}"

launchctl bootout "${USER_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1 || true

cat > "${PLIST_PATH}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>server/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/server.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/server.err.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "${USER_DOMAIN}" "${PLIST_PATH}"
launchctl kickstart -k "${USER_DOMAIN}/${LABEL}"

echo "已安装并启动开机自启服务：${LABEL}"
echo "配置文件：${PLIST_PATH}"
echo "日志文件：${LOG_DIR}/server.out.log 和 ${LOG_DIR}/server.err.log"
