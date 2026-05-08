#!/bin/bash
# 复制 yuanyue 用户设置到 leowang

SOURCE_USER="yuanyue"
TARGET_USER="leowang"
SOURCE_HOME="/Users/$SOURCE_USER"
TARGET_HOME="/Users/$TARGET_USER"

echo "开始复制 $SOURCE_USER 设置到 $TARGET_USER..."
echo "=========================================="

# 检查目标用户是否登录
if who | grep -q "$TARGET_USER"; then
    echo "警告: $TARGET_USER 当前已登录！"
    echo "请先让 $TARGET_USER 完全退出登录再继续。"
    read -p "是否仍要继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 复制偏好设置 (Preferences)
echo "[1/8] 复制系统偏好设置..."
sudo rsync -av --exclude='*.lockfile' "$SOURCE_HOME/Library/Preferences/" "$TARGET_HOME/Library/Preferences/" 2>/dev/null

# 复制 ByHost 设置
echo "[2/8] 复制 ByHost 特定设置..."
sudo rsync -av "$SOURCE_HOME/Library/Preferences/ByHost/" "$TARGET_HOME/Library/Preferences/ByHost/" 2>/dev/null

# 复制应用支持数据
echo "[3/8] 复制应用支持数据..."
sudo rsync -av --exclude='*.lock' --exclude='Cache' "$SOURCE_HOME/Library/Application Support/" "$TARGET_HOME/Library/Application Support/" 2>/dev/null

# 复制 ColorSync (显示器颜色配置)
echo "[4/8] 复制显示器颜色配置..."
sudo rsync -av "$SOURCE_HOME/Library/ColorSync/" "$TARGET_HOME/Library/ColorSync/" 2>/dev/null

# 复制 Services 服务设置
echo "[5/8] 复制服务设置..."
sudo rsync -av "$SOURCE_HOME/Library/Services/" "$TARGET_HOME/Library/Services/" 2>/dev/null

# 复制键盘快捷键设置
echo "[6/8] 复制键盘快捷键设置..."
sudo rsync -av "$SOURCE_HOME/Library/KeyBindings/" "$TARGET_HOME/Library/KeyBindings/" 2>/dev/null

# 复制 Fonts 字体
echo "[7/8] 复制字体..."
sudo rsync -av "$SOURCE_HOME/Library/Fonts/" "$TARGET_HOME/Library/Fonts/" 2>/dev/null

# 复制 Sounds 声音设置
echo "[8/8] 复制声音主题..."
sudo rsync -av "$SOURCE_HOME/Library/Sounds/" "$TARGET_HOME/Library/Sounds/" 2>/dev/null

# 修复文件权限
echo ""
echo "修复文件权限..."
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/Preferences"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/Application Support"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/ColorSync"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/Services"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/KeyBindings"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/Fonts"
sudo chown -R "$TARGET_USER:staff" "$TARGET_HOME/Library/Sounds"

echo ""
echo "=========================================="
echo "设置复制完成！"
echo ""
echo "下一步操作："
echo "1. 重启电脑"
echo "2. 登录 Leo wang 账户"
echo "3. 验证设置是否生效"
