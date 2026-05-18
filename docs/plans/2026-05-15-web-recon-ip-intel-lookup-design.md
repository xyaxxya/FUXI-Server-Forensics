# 公网远勘 IP 画像联网查询设计

## 背景

仅靠前端内置规则无法稳定识别云厂商和归属地。用户指出输入网址后应能主动搜索 IP 信息，例如解析 IP、CDN 厂商、IP 归属地和云厂商。当前后端只做 host RDAP 与 DNS 解析，没有对解析出的 IP 执行 IP intelligence 查询。

## 目标

- 对公网远勘解析出的 IP 执行联网查询
- 返回国家、省市、ISP、组织、ASN、AS 名称
- 前端画像优先使用真实查询结果，失败时回退内置规则
- 查询失败不影响主远勘流程
- 只修改远勘链路

## 数据源策略

- 优先使用 `http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp,org,as,asname,query,message`
- 该接口无 Key，返回 ISP、组织、ASN、城市等字段，适合先落地
- 请求失败、状态非 success 或超时时，返回 fallback 画像
- 后续可增加 pconline、ip.sb、ipinfo Lite 或本地 GeoIP 库作为第二/第三源

## 后端结构

新增 `WebReconIpIntelligence`：

- ip
- country
- region
- city
- isp
- organization
- asn
- asName
- source
- error

`WebReconTargetReport` 新增 `ipIntelligence: Vec<WebReconIpIntelligence>`。

## 前端策略

`WebReconTargetReport` 增加对应类型。`buildWebReconInfrastructureInsight` 优先读取 `ipIntelligence[0]`：

- provider 优先使用 organization/isp/asName
- location 优先拼 country/region/city
- evidence 加入 source、ASN、ISP
- 如果无查询结果则回退已有内置规则

## 验证标准

- 前端 helper 测试覆盖 ipIntelligence 优先级
- Rust 构建通过
- 前端构建通过
- 查询失败不阻断远勘
