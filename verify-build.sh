#!/bin/bash

# 构建验证脚本
# 用于验证 Electron 应用的构建产物是否完整

echo "========================================"
echo "V2rayZ 构建验证脚本"
echo "========================================"
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

function check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((TESTS_FAILED++))
        return 1
    fi
}

function check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((TESTS_FAILED++))
        return 1
    fi
}

# 1. 检查主进程构建
echo -e "${YELLOW}1. 检查主进程构建${NC}"
echo "----------------------------------------"

check_file "dist/main/main/index.js" "主进程入口文件"
check_file "dist/main/main/preload.js" "预加载脚本"
check_dir "dist/main/main/services" "服务层目录"
check_dir "dist/main/main/ipc" "IPC 通信层目录"

echo ""

# 2. 检查渲染进程构建
echo -e "${YELLOW}2. 检查渲染进程构建${NC}"
echo "----------------------------------------"

check_file "dist/renderer/index.html" "渲染进程入口 HTML"
check_dir "dist/renderer/assets" "前端资源目录"

if [ -d "dist/renderer/assets" ]; then
    JS_FILES=$(find dist/renderer/assets -name "*.js" | wc -l)
    CSS_FILES=$(find dist/renderer/assets -name "*.css" | wc -l)
    echo -e "${GRAY}  - JavaScript 文件: $JS_FILES${NC}"
    echo -e "${GRAY}  - CSS 文件: $CSS_FILES${NC}"
fi

echo ""

# 3. 检查 Windows 资源文件
echo -e "${YELLOW}3. 检查 Windows 资源文件${NC}"
echo "----------------------------------------"

check_file "resources/win/sing-box.exe" "Windows sing-box 可执行文件"
check_file "build/icon.ico" "Windows 应用图标"

if [ -f "resources/win/sing-box.exe" ]; then
    SIZE=$(du -h "resources/win/sing-box.exe" | cut -f1)
    echo -e "${GRAY}  - sing-box.exe 大小: $SIZE${NC}"
fi

echo ""

# 4. 检查 macOS 资源文件
echo -e "${YELLOW}4. 检查 macOS 资源文件${NC}"
echo "----------------------------------------"

check_file "resources/mac-x64/sing-box" "macOS x64 sing-box 可执行文件"
check_file "resources/mac-x64/app.icns" "macOS x64 应用图标"
check_file "resources/mac-arm64/sing-box" "macOS arm64 sing-box 可执行文件"
check_file "resources/mac-arm64/app.icns" "macOS arm64 应用图标"

echo ""

# 5. 检查数据文件
echo -e "${YELLOW}5. 检查数据文件${NC}"
echo "----------------------------------------"

check_file "resources/data/geoip-cn.srs" "GeoIP 中国数据"
check_file "resources/data/geosite-cn.srs" "GeoSite 中国数据"
check_file "resources/data/geosite-geolocation-!cn.srs" "GeoSite 非中国数据"

echo ""

# 6. 检查配置文件
echo -e "${YELLOW}6. 检查配置文件${NC}"
echo "----------------------------------------"

check_file "package.json" "package.json"
check_file "electron-builder.json" "electron-builder 配置"
check_file "tsconfig.json" "TypeScript 配置"
check_file "vite.config.ts" "Vite 配置"

echo ""

# 7. 检查测试文件
echo -e "${YELLOW}7. 检查测试文件${NC}"
echo "----------------------------------------"

TEST_FILES=$(find src -name "*.test.ts" -o -name "*.property.test.ts" | wc -l)
echo -e "${CYAN}找到 $TEST_FILES 个测试文件${NC}"

if [ $TEST_FILES -gt 0 ]; then
    echo -e "${GRAY}测试文件列表:${NC}"
    find src -name "*.test.ts" -o -name "*.property.test.ts" | while read file; do
        echo -e "${GRAY}  - $file${NC}"
    done
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ 未找到测试文件${NC}"
    ((TESTS_FAILED++))
fi

echo ""

# 8. 检查文档
echo -e "${YELLOW}8. 检查文档${NC}"
echo "----------------------------------------"

check_file "README.md" "README 文档"
check_file "WINDOWS_TEST_GUIDE.md" "Windows 测试指南"

echo ""

# 9. 检查 Node.js 环境
echo -e "${YELLOW}9. 检查开发环境${NC}"
echo "----------------------------------------"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js 版本: $NODE_VERSION"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} Node.js 未安装"
    ((TESTS_FAILED++))
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm 版本: $NPM_VERSION"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} npm 未安装"
    ((TESTS_FAILED++))
fi

echo ""

# 10. 检查依赖
echo -e "${YELLOW}10. 检查依赖安装${NC}"
echo "----------------------------------------"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules 目录存在"
    ((TESTS_PASSED++))
    
    # 检查关键依赖
    DEPS=("electron" "react" "react-dom" "vite" "typescript")
    for dep in "${DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            echo -e "${GRAY}  - $dep 已安装${NC}"
        else
            echo -e "${YELLOW}  ! $dep 未安装${NC}"
        fi
    done
else
    echo -e "${RED}✗${NC} node_modules 目录不存在"
    echo -e "${YELLOW}  提示: 运行 'npm install' 安装依赖${NC}"
    ((TESTS_FAILED++))
fi

echo ""

# 总结
echo "========================================"
echo -e "${CYAN}验证总结${NC}"
echo "========================================"
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查通过！构建产物完整。${NC}"
    echo ""
    echo -e "${CYAN}下一步:${NC}"
    echo "  1. 在 Windows 上运行 'test-windows.ps1' 进行系统测试"
    echo "  2. 参考 'WINDOWS_TEST_GUIDE.md' 进行完整的手动测试"
    echo "  3. 运行 'npm run package:win' 构建 Windows 安装包"
    exit 0
else
    echo -e "${YELLOW}! 部分检查失败，请检查上述错误。${NC}"
    echo ""
    echo -e "${CYAN}建议:${NC}"
    echo "  1. 运行 'npm install' 安装依赖"
    echo "  2. 运行 'npm run build' 重新构建"
    echo "  3. 检查资源文件是否完整"
    exit 1
fi
