#!/bin/bash
# 自动部署云函数的开发脚本
# 在后台运行，监听云函数代码变化自动部署

cd "$(dirname "$0")"

echo "=== WinPAR 高尔夫记分卡开发环境 ==="
echo ""
echo "功能："
echo "  - 自动监听云函数代码变化"
echo "  - 自动部署到云端"
echo ""
echo "命令："
echo "  npm run deploy      # 立即部署一次"
echo "  npm run deploy:watch # 启动监听模式"
echo "  npm run deploy:all   # 部署所有云函数"
echo ""

# 检查是否要启动监听模式
if [ "$1" == "--watch" ]; then
    echo "启动监听模式..."
    node auto-deploy.js --watch
else
    echo "立即部署云函数..."
    node auto-deploy.js
fi
