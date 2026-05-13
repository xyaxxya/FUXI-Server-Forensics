# 单次分析版远勘模块设计稿

## 1. 目标

将现有远勘模块收敛为一次性网站研判流程，面向批量输入的域名或 URL，完成单次采集、单次分析和单次展示。模块重点回答以下问题：

- 站点大致用途是什么
- 是否存在登录面、后台面、API 面
- 是否存在弱口令风险信号，但不执行任何密码尝试
- 站点大致如何搭建
- 哪些证据最值得人工优先查看

## 2. 范围边界

### 保留

- IP、DNS、RDAP / 注册商
- TLS 证书信息
- favicon hash
- 页面标题、描述、generator
- 技术栈识别
- 页面、JS、API、后台候选
- 表单与登录面识别
- 业务画像
- 风险排序

### 去掉

- 聚类分析
- 历史任务沉淀
- 多批次对比
- 图谱视图
- 结果库长期管理

### 密码相关边界

仅做“密码爆破识别”，不做任何密码尝试，不跑字典，不自动爆破，只判断是否存在弱口令风险信号，并给出证据。

## 3. 整体架构

### 3.1 输入层

支持输入：

- 域名
- URL
- 批量列表

职责：

- 去重
- 标准化
- 解析主机名
- 判断是否允许私网目标

### 3.2 公开信息采集层

采集公开可见信息，不执行任何凭据尝试。

采集内容：

- HTTP 状态、跳转链、标题、描述
- DNS、RDAP、注册商
- TLS 证书
- favicon hash
- security headers
- 页面 HTML
- JS 文件与资源路径
- robots / sitemap
- 外部服务域名
- 路径线索

### 3.3 研判层

负责把采集结果转成可读结论：

- 站点类型
- 业务类型
- 技术栈特征
- 后台 / API 线索
- 认证面风险
- 风险等级与证据说明

### 3.4 展示层

负责把结果展示成一个单次分析工作台。

## 4. 数据模型

### 4.1 目标报告

每个目标保留一份独立报告，建议字段包括：

- target
- normalizedUrl
- finalUrl
- status
- resolvedIps
- rdap
- dnsRecords
- serverHeader
- poweredBy
- contentType
- title
- metaDescription
- generator
- faviconUrl
- faviconMd5
- faviconMmh3
- techStack
- tlsCertificate
- artifactFindings
- externalHosts
- pathHints
- adminCandidates
- apiCandidates
- forms
- businessProfile
- architecture
- credentialSignals
- siteKind
- notes

建议补充：

- riskScore
- riskLevel
- riskReasons
- evidenceLevel
- confidence

其中 `credentialSignals` 仅用于记录认证面和弱口令风险信号，不包含任何密码尝试结果。

### 4.2 风险标签

风险标签要做到“可解释”。每个标签应包含：

- id
- level
- label
- description
- reason
- evidence
- category

推荐分类：

- surface：攻击面
- auth：认证面
- business：业务画像
- tech：技术栈暴露
- risk：风险提示

### 4.3 认证面识别结果

建议单独形成结构化结果：

- hasAuthSurface
- hasLoginForm
- hasAdminEntry
- hasApiAuthHint
- riskLevel
- riskScore
- signals
- evidence
- suggestedNextStep

只用于判断是否存在弱口令风险，不做任何尝试。

## 5. 页面布局与交互

### 5.1 页面分区

建议采用三块式布局：

#### 输入区

- 输入目标列表
- 配置是否探测后台路径
- 配置是否识别认证面风险
- 开始分析按钮

#### 总览区

- 目标数量
- 可访问数
- 登录面数量
- 后台候选数量
- 高风险目标数量
- 技术栈概览

#### 结果详情区

按目标展示详细证据：

- 概览
- 网络信息
- 页面与前端信息
- 后台与认证面
- 业务画像
- 风险说明

### 5.2 目标排序

默认按照风险分排序，优先级建议为：

1. 有认证面风险
2. 有后台候选
3. 有 API 线索
4. 业务画像更敏感
5. 技术栈暴露更明显

### 5.3 详情页标签

建议分为以下标签：

- 概览
- 网络与基础设施
- 页面与前端
- 后台与认证面
- 业务画像
- 备注与结论

## 6. 实施顺序

### 第一阶段：核心闭环

- 风险排序
- 认证面识别
- 后台 / API 聚合
- 单次结果详情展示

### 第二阶段：可读性增强

- 业务画像增强
- 总览驾驶舱
- 详情页分区
- 报告草稿

### 第三阶段：可维护性增强

- 人工备注
- 导出 JSON / Markdown
- 后续再考虑更高级的展示方式

## 7. 成功标准

一个批次分析完成后，用户能够直接看到：

- 哪些目标最值得看
- 哪些目标存在登录面或后台面
- 哪些目标存在弱口令风险信号
- 这些判断的证据是什么
- 下一步应该人工优先看什么

## 8. 结论

该设计将远勘模块收敛为一个轻量、明确、单次分析的研判工作台，保留核心信息采集与分析能力，去掉聚类和历史沉淀复杂度，适合当前项目的实际落地阶段。
