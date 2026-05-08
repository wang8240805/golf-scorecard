#!/bin/bash
# 设置自动部署后台服务
# 每次登录时自动启动云函数监听

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.winpar.autodeploy.plist"

# 获取正确的Node路径
NODE_PATH=$(which node)

echo "=== 设置自动部署服务 ==="
echo ""
echo "Node路径: $NODE_PATH"
echo ""

# 创建 LaunchAgent plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.winpar.autodeploy</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${SCRIPT_DIR}/auto-deploy.js</string>
        <string>--watch</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${NODE_PATH%/*}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/winpar-autodeploy.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/winpar-autodeploy-error.log</string>
    <key>WorkingDirectory</key>
    <string>${SCRIPT_DIR}</string>
</dict>
</plist>
EOF

echo "✅ 已创建 LaunchAgent: $PLIST_PATH"
echo ""

# 停止旧服务
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# 启动新服务
launchctl load "$PLIST_PATH"

sleep 1

echo "✅ 服务已启动"
echo ""
echo "管理命令："
echo "  查看状态: launchctl list | grep winpar"
echo "  停止服务: launchctl unload $PLIST_PATH"
echo "  启动服务: launchctl load $PLIST_PATH"
echo "  查看日志: tail -f /tmp/winpar-autodeploy.log"
echo ""
echo "现在修改云函数代码后会自动部署到云端！"
