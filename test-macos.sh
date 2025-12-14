#!/bin/bash
# test-macos.sh - macOS 平台测试脚本

echo "开始 macOS 测试流程..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 1. 检查系统信息
echo -e "\n${YELLOW}检查系统信息...${NC}"
echo -e "macOS 版本: $(sw_vers -productVersion)"
echo -e "架构: $(uname -m)"
echo -e "Node.js 版本: $(node --version)"

# 2. 检查构建产物
echo -e "\n${YELLOW}检查构建产物...${NC}"
if [ -f "dist/main/main/index.js" ]; then
    echo -e "${GREEN}✓ 主进程构建存在${NC}"
else
    echo -e "${RED}✗ 主进程构建缺失${NC}"
    exit 1
fi

if [ -f "dist/renderer/index.html" ]; then
    echo -e "${GREEN}✓ 渲染进程构建存在${NC}"
else
    echo -e "${RED}✗ 渲染进程构建缺失${NC}"
    exit 1
fi

# 3. 检查资源文件
echo -e "\n${YELLOW}检查资源文件...${NC}"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    RESOURCE_DIR="resources/mac-arm64"
else
    RESOURCE_DIR="resources/mac-x64"
fi

if [ -f "$RESOURCE_DIR/sing-box" ]; then
    echo -e "${GREEN}✓ sing-box 可执行文件存在${NC}"
    echo -e "${CYAN}  路径: $RESOURCE_DIR/sing-box${NC}"
    
    # 检查权限
    if [ -x "$RESOURCE_DIR/sing-box" ]; then
        echo -e "${GREEN}✓ sing-box 具有可执行权限${NC}"
    else
        echo -e "${YELLOW}! sing-box 缺少可执行权限，正在添加...${NC}"
        chmod +x "$RESOURCE_DIR/sing-box"
    fi
    
    # 检查架构
    FILE_ARCH=$(file "$RESOURCE_DIR/sing-box" | grep -o "arm64\|x86_64")
    echo -e "${CYAN}  sing-box 架构: $FILE_ARCH${NC}"
    
    # 验证版本
    if "$RESOURCE_DIR/sing-box" version &> /dev/null; then
        VERSION=$("$RESOURCE_DIR/sing-box" version 2>&1 | head -1)
        echo -e "${GREEN}✓ sing-box 可执行: $VERSION${NC}"
    else
        echo -e "${RED}✗ sing-box 无法执行${NC}"
    fi
else
    echo -e "${RED}✗ sing-box 可执行文件缺失${NC}"
    exit 1
fi

# 4. 检查配置文件
CONFIG_PATH="$HOME/Library/Application Support/v2rayz-electron/config.json"
echo -e "\n${YELLOW}检查配置文件: $CONFIG_PATH${NC}"
if [ -f "$CONFIG_PATH" ]; then
    echo -e "${GREEN}✓ 配置文件存在${NC}"
    SERVER_COUNT=$(cat "$CONFIG_PATH" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['servers']))" 2>/dev/null || echo "0")
    echo -e "${CYAN}  服务器数量: $SERVER_COUNT${NC}"
else
    echo -e "${YELLOW}! 配置文件不存在（首次运行正常）${NC}"
fi

# 5. 检查系统代理设置
echo -e "\n${YELLOW}检查系统代理设置...${NC}"
NETWORK_SERVICE="Wi-Fi"
if networksetup -listallnetworkservices | grep -q "Wi-Fi"; then
    NETWORK_SERVICE="Wi-Fi"
elif networksetup -listallnetworkservices | grep -q "Ethernet"; then
    NETWORK_SERVICE="Ethernet"
fi

WEB_PROXY=$(networksetup -getwebproxy "$NETWORK_SERVICE" | grep "Enabled: Yes")
if [ -n "$WEB_PROXY" ]; then
    echo -e "${YELLOW}! 系统代理已启用${NC}"
    PROXY_SERVER=$(networksetup -getwebproxy "$NETWORK_SERVICE" | grep "Server:" | awk '{print $2}')
    PROXY_PORT=$(networksetup -getwebproxy "$NETWORK_SERVICE" | grep "Port:" | awk '{print $2}')
    echo -e "${CYAN}  代理服务器: $PROXY_SERVER:$PROXY_PORT${NC}"
else
    echo -e "${GREEN}✓ 系统代理未启用${NC}"
fi

# 6. 检查自启动设置
echo -e "\n${YELLOW}检查自启动设置...${NC}"
if osascript -e 'tell application "System Events" to get the name of every login item' 2>/dev/null | grep -q "V2rayZ"; then
    echo -e "${YELLOW}! 自启动已启用${NC}"
else
    echo -e "${GREEN}✓ 自启动未启用${NC}"
fi

# 7. 检查进程
echo -e "\n${YELLOW}检查相关进程...${NC}"
if pgrep -f "electron" > /dev/null; then
    ELECTRON_PID=$(pgrep -f "electron")
    echo -e "${YELLOW}! Electron 进程运行中 (PID: $ELECTRON_PID)${NC}"
else
    echo -e "${GREEN}✓ Electron 进程未运行${NC}"
fi

if pgrep -f "sing-box" > /dev/null; then
    SINGBOX_PID=$(pgrep -f "sing-box")
    echo -e "${YELLOW}! sing-box 进程运行中 (PID: $SINGBOX_PID)${NC}"
else
    echo -e "${GREEN}✓ sing-box 进程未运行${NC}"
fi

# 8. 检查端口占用
echo -e "\n${YELLOW}检查端口占用...${NC}"
if lsof -i :65533 > /dev/null 2>&1; then
    echo -e "${YELLOW}! 端口 65533 被占用${NC}"
    lsof -i :65533
else
    echo -e "${GREEN}✓ 端口 65533 未被占用${NC}"
fi

if lsof -i :65534 > /dev/null 2>&1; then
    echo -e "${YELLOW}! 端口 65534 被占用${NC}"
    lsof -i :65534
else
    echo -e "${GREEN}✓ 端口 65534 未被占用${NC}"
fi

echo -e "\n${GREEN}测试检查完成！${NC}"
echo -e "${CYAN}请参考 MACOS_TEST_GUIDE.md 进行完整的手动测试。${NC}"
