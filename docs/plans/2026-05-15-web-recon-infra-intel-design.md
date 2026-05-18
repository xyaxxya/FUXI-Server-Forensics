# 公网远勘基础设施画像增强设计

## 背景

用户指出公网远勘输入网址后应能给出具体基础设施信息，例如解析 IP、是否 CDN、CDN 厂商、IP 归属地、云厂商或运营商。当前系统已有 resolvedIps、DNS、RDAP，但缺少统一的基础设施画像。

## 目标

- 只修改远勘相关链路
- 输入网址后展示 IP、归属地、云/CDN 厂商、是否 CDN
- 混合增强：内置规则稳定输出，公网查询作为增强，失败自动降级
- 不让公网查询失败影响主远勘流程

## 分层方案

### 前端画像层

在 `webRecon.ts` 新增基础设施画像 helper：

- 根据 `resolvedIps` 展示主 IP
- 根据 DNS 记录、外部主机、架构 edge 字段识别 CDN
- 根据 RDAP registrar/name/remarks、server header、host 特征识别云/CDN厂商
- 支持常见厂商：阿里云、腾讯云、京东云、华为云、百度云、Cloudflare、Akamai、Fastly、AWS、Azure、Google Cloud
- 对无法确认的字段明确显示“待核验”，而不是留空

### 后端增强层

预留公网 IP 查询位置，可后续接 ip-api/ipinfo/ipapi 或本地 IP 库。当前实现先保证前端和报告可消费统一画像字段。

## UI 展示

- 优先目标队列增加“基础设施”一行：主 IP / CDN / 厂商
- 重点目标轻详情增加“基础设施画像”：IP、CDN、厂商、属地
- 报告和深度远勘带入时使用该画像作为可调证线索

## 验证标准

- helper 测试覆盖京东云示例
- helper 测试覆盖 Cloudflare CDN 示例
- TypeScript 诊断无错误
- 构建通过
