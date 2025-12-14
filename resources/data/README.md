# GeoIP 和 GeoSite 数据文件

## 文件说明

这个目录包含 sing-box 使用的地理位置和域名分类数据文件：

- `geoip-cn.srs` - 中国 IP 地址段数据（sing-box rule-set 格式）
- `geosite-cn.srs` - 中国域名列表（sing-box rule-set 格式）
- `geosite-geolocation-!cn.srs` - 非中国域名列表（sing-box rule-set 格式）

## 用途

这些文件用于智能分流模式，帮助 sing-box 决定哪些流量应该通过代理，哪些应该直连：

- **智能分流模式**: 中国 IP 和域名直连，其他通过代理
- **自定义规则**: 可以基于这些数据创建更复杂的路由规则

## 数据来源

这些文件来自 sing-box 官方的 rule-set 仓库：
- https://github.com/SagerNet/sing-geoip
- https://github.com/SagerNet/sing-geosite

## 更新

建议定期更新这些文件以获得最新的 IP 和域名数据。可以从以下地址下载：

```bash
# GeoIP 中国
curl -L -o geoip-cn.srs https://github.com/SagerNet/sing-geoip/releases/latest/download/geoip-cn.srs

# GeoSite 中国
curl -L -o geosite-cn.srs https://github.com/SagerNet/sing-geosite/releases/latest/download/geosite-cn.srs

# GeoSite 非中国
curl -L -o geosite-geolocation-\!cn.srs https://github.com/SagerNet/sing-geosite/releases/latest/download/geosite-geolocation-\!cn.srs
```

## 在 sing-box 配置中使用

```json
{
  "route": {
    "rule_set": [
      {
        "tag": "geoip-cn",
        "type": "local",
        "format": "binary",
        "path": "/path/to/geoip-cn.srs"
      },
      {
        "tag": "geosite-cn",
        "type": "local",
        "format": "binary",
        "path": "/path/to/geosite-cn.srs"
      }
    ],
    "rules": [
      {
        "rule_set": ["geoip-cn", "geosite-cn"],
        "outbound": "direct"
      }
    ]
  }
}
```
