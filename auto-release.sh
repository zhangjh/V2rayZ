#!/bin/bash

# V2rayZ 自动发布脚本
# 将已构建的 publish 目录打包并上传到 GitHub Release

set -e

# 错误处理函数
handle_error() {
    local exit_code=$?
    local line_number=$1
    print_error "脚本在第 $line_number 行失败，退出码: $exit_code"
    exit $exit_code
}

# 设置错误陷阱
trap 'handle_error $LINENO' ERR

# 配置信息
REPO_OWNER="zhangjh"
REPO_NAME="V2rayZ"
OUTPUT_DIR="./publish"
VERSION=""
GITHUB_TOKEN="${GITHUB_TOKEN}"
PRE_RELEASE=false
DRAFT=false
RELEASE_NOTES=""
USE_JQ=true
USE_ZIP=true
ZIP_CMD=""
DEBUG=false
SKIP_TAG=false

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${CYAN}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

print_debug() {
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${YELLOW}[调试]${NC} $1"
    fi
}

# 显示帮助信息
show_help() {
    echo "V2rayZ 自动发布脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -v, --version VERSION    指定版本号 (默认从 VersionInfo.cs 读取)"
    echo "  -t, --token TOKEN        GitHub Token (或使用环境变量 GITHUB_TOKEN)"
    echo "  -p, --pre-release        创建预发布版本"
    echo "  -d, --draft              创建草稿版本"
    echo "  -n, --notes NOTES        自定义发布说明"
    echo "  --debug                  启用调试模式"
    echo "  --skip-tag               跳过 Git 标签创建（标签已存在时使用）"
    echo "  -h, --help               显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                       # 基本用法"
    echo "  $0 -v 1.4.1             # 指定版本号"
    echo "  $0 -p                    # 创建预发布版本"
    echo "  $0 -d -n \"测试版本\"      # 创建草稿并添加说明"
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -t|--token)
                GITHUB_TOKEN="$2"
                shift 2
                ;;
            -p|--pre-release)
                PRE_RELEASE=true
                shift
                ;;
            -d|--draft)
                DRAFT=true
                shift
                ;;
            -n|--notes)
                RELEASE_NOTES="$2"
                shift 2
                ;;
            --debug)
                DEBUG=true
                shift
                ;;
            --skip-tag)
                SKIP_TAG=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# JSON 处理函数
json_extract() {
    local json="$1"
    local key="$2"
    
    if [[ "$USE_JQ" == "true" ]]; then
        echo "$json" | jq -r "$key // empty"
    else
        # 使用正则表达式提取 JSON 值 (简单但有效的后备方案)
        local pattern="\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]*)\""
        if [[ $json =~ $pattern ]]; then
            echo "${BASH_REMATCH[1]}"
        else
            # 尝试提取数字值
            local number_pattern="\"$key\"[[:space:]]*:[[:space:]]*([0-9]+)"
            if [[ $json =~ $number_pattern ]]; then
                echo "${BASH_REMATCH[1]}"
            else
                echo ""
            fi
        fi
    fi
}

json_create() {
    local tag_name="$1"
    local name="$2"
    local body="$3"
    local draft="$4"
    local prerelease="$5"
    
    if [[ "$USE_JQ" == "true" ]]; then
        jq -n \
            --arg tag_name "$tag_name" \
            --arg name "$name" \
            --arg body "$body" \
            --argjson draft "$draft" \
            --argjson prerelease "$prerelease" \
            '{
                tag_name: $tag_name,
                target_commitish: "master",
                name: $name,
                body: $body,
                draft: $draft,
                prerelease: $prerelease
            }'
    else
        # 使用 printf 和更简单的方法创建 JSON
        # 转义 JSON 特殊字符
        local escaped_tag_name=$(printf '%s' "$tag_name" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')
        local escaped_name=$(printf '%s' "$name" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')
        
        # 处理 body 中的换行符和特殊字符
        local escaped_body=$(printf '%s' "$body" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        
        # 转换布尔值
        local draft_bool="false"
        local prerelease_bool="false"
        [[ "$draft" == "true" ]] && draft_bool="true"
        [[ "$prerelease" == "true" ]] && prerelease_bool="true"
        
        printf '{"tag_name":"%s","target_commitish":"master","name":"%s","body":"%s","draft":%s,"prerelease":%s}' \
            "$escaped_tag_name" "$escaped_name" "$escaped_body" "$draft_bool" "$prerelease_bool"
    fi
}

# 检查必要工具
check_requirements() {
    print_info "检查必要工具..."
    
    # 检查 curl
    if ! command -v curl &> /dev/null; then
        print_error "curl 未安装"
        exit 1
    fi
    
    # 检查 JSON 处理工具
    if command -v jq &> /dev/null; then
        USE_JQ=true
        print_info "使用 jq 处理 JSON"
    elif command -v powershell.exe &> /dev/null || command -v pwsh &> /dev/null; then
        USE_JQ=false
        print_info "使用 PowerShell 处理 JSON"
    else
        print_error "需要 jq 或 PowerShell 来处理 JSON"
        print_error "Windows 用户可以:"
        print_error "1. 安装 jq: choco install jq"
        print_error "2. 手动下载: curl -L https://github.com/stedolan/jq/releases/download/jq-1.6/jq-win64.exe -o ~/bin/jq.exe"
        exit 1
    fi
    
    # 检查压缩工具
    if command -v zip &> /dev/null; then
        USE_ZIP=true
        ZIP_CMD="zip"
        print_info "使用 zip 进行压缩"
    elif command -v 7z &> /dev/null; then
        USE_ZIP=false
        ZIP_CMD="7z"
        print_info "使用 7zip 进行压缩"
    else
        # 检查常见的 7zip 安装路径
        local seven_zip_paths=(
            "/c/Program Files/7-Zip/7z.exe"
            "/c/Program Files (x86)/7-Zip/7z.exe"
            "C:/Program Files/7-Zip/7z.exe"
            "C:/Program Files (x86)/7-Zip/7z.exe"
        )
        
        for path in "${seven_zip_paths[@]}"; do
            if [[ -f "$path" ]]; then
                USE_ZIP=false
                ZIP_CMD="$path"
                print_info "找到 7zip: $path"
                break
            fi
        done
        
        if [[ -z "$ZIP_CMD" ]]; then
            print_error "需要 zip 或 7zip 来创建压缩包"
            print_error "Windows 用户可以:"
            print_error "1. 安装 7zip: https://www.7-zip.org/"
            print_error "2. 安装 zip: choco install zip"
            print_error "3. 或者将 7z.exe 添加到 PATH 中"
            exit 1
        fi
    fi
    
    # 检查 git
    if ! command -v git &> /dev/null; then
        print_error "git 未安装"
        exit 1
    fi
    
    # 检查 GitHub Token
    if [[ -z "$GITHUB_TOKEN" ]]; then
        print_error "GitHub Token 未提供"
        print_error "请设置环境变量: export GITHUB_TOKEN=your_token"
        print_error "或使用参数: $0 -t your_token"
        exit 1
    fi
    
    print_success "所有必要工具已安装"
}

# 获取版本号
get_version() {
    if [[ -n "$VERSION" ]]; then
        print_info "使用指定版本: $VERSION"
        return
    fi
    
    print_info "从 VersionInfo.cs 读取版本号..."
    
    local version_file="V2rayClient/VersionInfo.cs"
    if [[ ! -f "$version_file" ]]; then
        print_error "版本文件不存在: $version_file"
        exit 1
    fi
    
    VERSION=$(grep 'public const string Version = ' "$version_file" | sed 's/.*= "\([^"]*\)".*/\1/')
    
    if [[ -z "$VERSION" ]]; then
        print_error "无法从 $version_file 解析版本号"
        exit 1
    fi
    
    print_success "读取到版本号: $VERSION"
}

# 检查 publish 目录
check_publish_dir() {
    print_info "检查 publish 目录..."
    
    if [[ ! -d "$OUTPUT_DIR" ]]; then
        print_error "publish 目录不存在: $OUTPUT_DIR"
        print_error "请先运行构建脚本生成 publish 目录"
        exit 1
    fi
    
    # 检查关键文件
    local exe_file="$OUTPUT_DIR/V2rayZ.exe"
    if [[ ! -f "$exe_file" ]]; then
        print_error "主程序文件不存在: $exe_file"
        exit 1
    fi
    
    local wwwroot_dir="$OUTPUT_DIR/wwwroot"
    if [[ ! -d "$wwwroot_dir" ]]; then
        print_error "前端文件目录不存在: $wwwroot_dir"
        exit 1
    fi
    
    print_success "publish 目录验证通过"
}

# 检查 Git 状态
check_git_status() {
    print_info "检查 Git 仓库状态..."
    
    if [[ ! -d ".git" ]]; then
        print_error "当前目录不是 Git 仓库"
        exit 1
    fi
    
    local branch=$(git rev-parse --abbrev-ref HEAD)
    print_info "当前分支: $branch"
    
    # 检查标签是否已存在
    local tag_name="v$VERSION"
    if git tag -l | grep -q "^$tag_name$"; then
        print_error "标签 $tag_name 已存在"
        print_error "请使用不同的版本号或删除现有标签: git tag -d $tag_name"
        exit 1
    fi
    
    print_success "Git 状态检查通过"
}

# 创建发布包

create_release_package() {
    print_info "创建发布包..." >&2
    
    local zip_name="V2rayZ-${VERSION}-win-x64.zip"
    
    # 删除已存在的 zip 文件
    if [[ -f "$zip_name" ]]; then
        rm "$zip_name"
        print_info "删除已存在的包: $zip_name" >&2
    fi
    
    # 创建 ZIP 包
    print_info "正在打包 $OUTPUT_DIR 到 $zip_name..." >&2
    
    if [[ "$USE_ZIP" == "true" ]]; then
        # 使用标准 zip 命令
        cd "$OUTPUT_DIR"
        "$ZIP_CMD" -r "../$zip_name" . -x "*.log" "*.tmp" >&2
        cd ..
    else
        # 使用 7zip
        "$ZIP_CMD" a "$zip_name" "$OUTPUT_DIR/*" -x!"*.log" -x!"*.tmp" >&2
    fi
    
    if [[ ! -f "$zip_name" ]]; then
        print_error "创建 ZIP 包失败" >&2
        exit 1
    fi
    
    local zip_size=$(du -h "$zip_name" | cut -f1)
    print_success "创建发布包成功: $zip_name ($zip_size)" >&2
    
    print_debug "准备返回文件名: $zip_name" >&2
    print_debug "文件是否存在: $(test -f "$zip_name" && echo "是" || echo "否")" >&2
    
    # 只输出文件名到 stdout
    echo "$zip_name"
}

# 创建 Git 标签
create_git_tag() {
    local tag_name="v$VERSION"
    local tag_message="Release v$VERSION"
    
    print_info "创建 Git 标签: $tag_name"
    
    git tag -a "$tag_name" -m "$tag_message"
    
    print_info "推送标签到远程仓库..."
    git push origin "$tag_name"
    
    print_success "Git 标签创建并推送成功"
}

# 生成默认发布说明
get_default_release_notes() {
    if [[ -n "$RELEASE_NOTES" ]]; then
        echo "$RELEASE_NOTES"
        return
    fi
    
    cat << EOF
## V2rayZ v$VERSION

### 更新内容
- 性能优化和错误修复
- 用户体验改进

### 下载说明
- 下载 \`V2rayZ-$VERSION-win-x64.zip\` 文件
- 解压后运行 \`V2rayZ.exe\`
- 支持 Windows 10 (1809+) 和 Windows 11

### 系统要求
- Windows 10 (1809+) 或 Windows 11
- WebView2 Runtime (Windows 11 自带)
- .NET 8 Runtime (自包含版本无需安装)

---
**完整更新日志**: https://github.com/$REPO_OWNER/$REPO_NAME/compare/v$VERSION...HEAD
EOF
}

# 创建 GitHub Release
create_github_release() {
    local tag_name="v$VERSION"
    local release_name="V2rayZ v$VERSION"
    local release_body=$(get_default_release_notes)
    
    print_info "创建 GitHub Release..."
    
    # 准备 JSON 数据
    local json_data=$(json_create "$tag_name" "$release_name" "$release_body" "$DRAFT" "$PRE_RELEASE")
    
    print_debug "生成的 JSON 数据:"
    print_debug "$json_data"
    
    # 创建 Release
    local api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases"
    
    print_debug "API URL: $api_url"
    print_debug "JSON 数据长度: ${#json_data}"
    
    # 将 JSON 数据写入临时文件，避免命令行长度限制
    local temp_json=$(mktemp)
    echo "$json_data" > "$temp_json"
    
    print_debug "临时 JSON 文件: $temp_json"
    print_debug "文件内容:"
    if [[ "$DEBUG" == "true" ]]; then
        cat "$temp_json" >&2
    fi
    
    local response=$(curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Content-Type: application/json" \
        --data-binary "@$temp_json" \
        "$api_url")
    
    rm -f "$temp_json"
    
    # 调试响应
    print_debug "GitHub API 响应长度: ${#response}"
    print_debug "完整响应内容:"
    if [[ "$DEBUG" == "true" ]]; then
        echo "$response" >&2
    fi
    
    # 检查是否成功
    local release_id=$(json_extract "$response" "id")
    if [[ -z "$release_id" ]]; then
        print_error "创建 GitHub Release 失败"
        print_error "完整响应:"
        echo "$response"
        
        local error_msg=$(json_extract "$response" "message")
        if [[ -n "$error_msg" ]]; then
            print_error "错误信息: $error_msg"
        fi
        exit 1
    fi
    
    local release_url=$(json_extract "$response" "html_url")
    local upload_url=$(json_extract "$response" "upload_url")
    print_success "GitHub Release 创建成功: $release_url"
    print_debug "Upload URL: $upload_url"
    
    echo "$response"
}

# 上传发布文件
upload_release_asset() {
    local release_response="$1"
    local zip_file="$2"
    
    print_info "上传发布文件: $zip_file"
    
    local upload_url=$(json_extract "$release_response" "upload_url" | sed 's/{?name,label}//')
    local file_name=$(basename "$zip_file")
    
    # 调试 upload_url
    print_debug "原始 release_response 长度: ${#release_response}"
    print_debug "提取的 upload_url: '$upload_url'"
    print_debug "upload_url 长度: ${#upload_url}"
    
    if [[ -z "$upload_url" ]]; then
        print_error "无法从 GitHub Release 响应中提取 upload_url"
        print_error "Release 响应内容:"
        echo "$release_response" | head -20
        exit 1
    fi
    
    # 检查文件是否存在
    if [[ ! -f "$zip_file" ]]; then
        print_error "ZIP 文件不存在: $zip_file"
        exit 1
    fi
    
    # 获取文件大小
    local file_size=$(stat -c%s "$zip_file" 2>/dev/null || stat -f%z "$zip_file" 2>/dev/null || wc -c < "$zip_file")
    local file_size_mb=$((file_size / 1024 / 1024))
    print_info "文件大小: $file_size 字节 (${file_size_mb}MB)"
    
    # 检查文件大小限制 (GitHub Release 资产限制为 2GB)
    if [[ $file_size -gt 2147483648 ]]; then
        print_error "文件太大 (${file_size_mb}MB)，GitHub Release 资产限制为 2GB"
        exit 1
    fi
    
    # 上传文件 - 使用绝对路径和更好的错误处理
    local abs_zip_file
    if command -v realpath &> /dev/null; then
        abs_zip_file=$(realpath "$zip_file")
    else
        # Windows Git Bash 可能没有 realpath
        abs_zip_file=$(cd "$(dirname "$zip_file")" && pwd)/$(basename "$zip_file")
    fi
    
    print_info "上传文件: $abs_zip_file"
    print_info "上传到: ${upload_url}?name=${file_name}"
    
    # 验证文件路径
    if [[ ! -f "$abs_zip_file" ]]; then
        print_error "无法访问文件: $abs_zip_file"
        print_info "当前目录: $(pwd)"
        print_info "原始文件路径: $zip_file"
        print_info "尝试的绝对路径: $abs_zip_file"
        ls -la "$zip_file" 2>/dev/null || echo "文件不存在"
        exit 1
    fi
    
    # 显示调试信息
    print_info "文件验证通过"
    print_info "当前工作目录: $(pwd)"
    print_info "文件权限: $(ls -la "$abs_zip_file")"
    
    # 创建临时文件来分离 curl 输出和错误
    local curl_output=$(mktemp)
    local curl_error=$(mktemp)
    
    # 上传文件
    if curl -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Content-Type: application/zip" \
        -H "Accept: application/vnd.github.v3+json" \
        --data-binary "@${abs_zip_file}" \
        "${upload_url}?name=${file_name}" \
        -o "$curl_output" \
        -w "HTTP Status: %{http_code}\n" \
        2>"$curl_error"; then
        
        local upload_response=$(cat "$curl_output")
        print_info "上传请求成功"
    else
        print_error "curl 上传失败"
        echo "错误信息:"
        cat "$curl_error"
        rm -f "$curl_output" "$curl_error"
        exit 1
    fi
    
    # 清理临时文件
    rm -f "$curl_error"
    
    # 检查上传结果
    local asset_id=$(json_extract "$upload_response" "id")
    if [[ -z "$asset_id" ]]; then
        print_error "上传发布文件失败"
        echo "响应内容:"
        cat "$curl_output"
        
        local error_msg=$(json_extract "$upload_response" "message")
        if [[ -n "$error_msg" ]]; then
            echo "错误信息: $error_msg"
        fi
        
        rm -f "$curl_output"
        exit 1
    fi
    
    rm -f "$curl_output"
    
    local download_url=$(json_extract "$upload_response" "browser_download_url")
    print_success "文件上传成功: $download_url"
}

# 主执行流程
main() {
    echo -e "${CYAN}========================================"
    echo -e "V2rayZ 自动发布脚本"
    echo -e "========================================${NC}"
    echo ""
    
    # 解析命令行参数
    parse_args "$@"
    
    # 1. 检查必要工具
    check_requirements
    
    # 2. 获取版本信息
    get_version
    
    # 3. 检查 publish 目录
    check_publish_dir
    
    # 4. 检查 Git 状态
    check_git_status
    
    echo ""
    echo -e "${CYAN}发布信息:${NC}"
    echo -e "  版本: ${VERSION}"
    echo -e "  标签: v${VERSION}"
    echo -e "  仓库: ${REPO_OWNER}/${REPO_NAME}"
    echo -e "  预发布: ${PRE_RELEASE}"
    echo -e "  草稿: ${DRAFT}"
    echo ""
    
    # 确认发布
    read -p "确认发布? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "用户取消发布"
        exit 0
    fi
    
    # 5. 创建发布包
    print_info "步骤 5: 开始创建发布包..."
    print_debug "调用 create_release_package 函数"
    local zip_file=$(create_release_package)
    print_debug "create_release_package 返回值: '$zip_file'"
    print_debug "zip_file 变量长度: ${#zip_file}"
    
    if [[ -z "$zip_file" ]]; then
        print_error "create_release_package 返回了空值"
        exit 1
    fi
    
    if [[ ! -f "$zip_file" ]]; then
        print_error "ZIP 文件不存在: $zip_file"
        print_debug "当前目录内容:"
        ls -la *.zip 2>/dev/null || echo "没有找到 ZIP 文件"
        exit 1
    fi
    
    print_success "步骤 5: 发布包创建完成: $zip_file"
    
    # 6. 创建并推送 Git 标签
    print_info "步骤 6: 开始创建 Git 标签..."
    print_debug "调用 create_git_tag 函数"
    create_git_tag
    print_debug "create_git_tag 函数执行完成"
    print_success "步骤 6: Git 标签创建完成"
    
    # 7. 创建 GitHub Release
    print_info "步骤 7: 开始创建 GitHub Release..."
    local release_response=$(create_github_release)
    print_success "步骤 7: GitHub Release 创建完成"
    
    # 8. 上传发布文件
    print_info "步骤 8: 开始上传发布文件..."
    upload_release_asset "$release_response" "$zip_file"
    print_success "步骤 8: 发布文件上传完成"
    
    # 9. 完成
    echo ""
    echo -e "${CYAN}========================================"
    echo -e "发布完成!"
    echo -e "========================================${NC}"
    echo ""
    
    local release_url=$(json_extract "$release_response" "html_url")
    local download_url="${release_url/\/tag\//\/download\/}/$zip_file"
    
    echo -e "${GREEN}Release URL: $release_url${NC}"
    echo -e "${GREEN}下载链接: $download_url${NC}"
    echo ""
    
    if [[ "$DRAFT" == "true" ]]; then
        print_warning "注意: Release 创建为草稿状态，需要手动发布"
    fi
    
    # 清理临时文件
    print_info "清理临时文件: $zip_file"
    rm -f "$zip_file"
}

# 错误处理
trap 'print_error "脚本执行失败，退出码: $?"' ERR

# 执行主函数
main "$@"