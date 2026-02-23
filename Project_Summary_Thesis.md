# 基于MCP大模型的远程服务器取证与智能分析工具设计与实现 - 技术总结报告

## 1. 项目概况 (Project Overview)

本项目是一款基于 **Tauri 2.0** (Rust + React) 架构开发的现代化远程服务器取证与智能分析平台。它融合了 **MCP (Model Context Protocol)** 的设计理念，通过集成多种大语言模型（LLM），实现了对 Linux 服务器、数据库及容器环境的自动化取证、异常检测与智能分析。

项目核心旨在解决传统取证门槛高、人工分析效率低的问题，通过 "Agent（智能体）" 的方式，让大模型具备"手"（工具执行）和"眼"（环境感知）的能力，辅助取证人员快速定位嫌疑人痕迹、Webshell、恶意配置及资金流向。

---

## 2. 技术栈 (Technical Stack)

### 2.1 前端 (Frontend)

- **框架**: React 19, TypeScript
- **构建工具**: Vite 7
- **样式方案**: Tailwind CSS 4, clsx, tailwind-merge
- **UI 组件**:
  - `Lucide React` (图标库)
  - `Framer Motion` (平滑动画与交互)
  - `Monaco Editor` (代码/日志查看器)
  - `Xterm.js` (Web 终端模拟器)
  - `Recharts` (数据可视化图表)
- **状态管理**: Zustand (轻量级全局状态管理)

### 2.2 后端 (Backend)

- **核心框架**: Rust (Tauri 2.0) - 提供高性能、跨平台的本地运行时。
- **远程连接**: `ssh2` crate - 实现安全的 SSH 协议连接与命令执行。
- **数据库交互**: `mysql` crate - 用于直接连接远程 MySQL 数据库进行取证。
- **系统监控**: `sysinfo` - 获取本地及远程系统状态。
- **安全性**: 本地运行，通过加密通道连接服务器，无需在目标服务器安装 Agent (Agentless 模式)，最大程度保护现场。

### 2.3 人工智能与大模型 (AI & LLM)

- **多模型支持**: 集成 OpenAI (GPT-4), Claude (3.5 Sonnet), Zhipu AI (GLM-4), Qwen (通义千问), Kimi (Moonshot)。
- **交互协议**: 自研 `sendToAI` 统一接口，适配不同模型的 Function Calling (工具调用) 格式。
- **思维链 (CoT)**: 实现了 `ThinkingProcess` 模块，强制模型输出 "思考-执行-反馈" 的完整决策链路。

---

## 3. 核心功能 (Core Features)

### 3.1 智能取证 Agent 体系

项目设计了专用的智能体来处理不同领域的取证任务：

- **General Agent (综合取证智能体)**:
  - 负责 Linux 操作系统层面的取证。
  - **能力**: 执行 Shell 命令、分析系统日志 (`/var/log/*`)、检查进程 (`ps`)、网络连接 (`netstat/ss`)、文件系统痕迹。
  - **特性**: 具备 "Deep Forensic Mode" (深度取证模式)，通过多轮对话自主排查疑点。
- **Database Agent (数据库取证智能体)**:
  - 负责 MySQL 等数据库的深度分析。
  - **能力**: `list_tables` (表结构分析), `get_schema` (字段语义理解), `run_sql` (数据检索)。
  - **场景**: 自动识别 "admin/user" 表，查找特权账号；分析 "log" 表，追踪后台操作记录；资金流向分析。
  - **安全**: 限制仅执行 `SELECT` 查询，严禁 `UPDATE/DELETE`，确保数据完整性。

### 3.2 插件化取证工具箱 (Plugin System)

内置了一系列标准化的取证插件，既可手动触发，也可被 Agent 调用：

- **Security Plugin (安全审计)**: 检测特权用户 (UID=0)、分析 SSH 登录日志 (成功/失败记录)、检查防火墙状态、Crontab 定时任务。
- **Jar Analysis (Java 取证)**: 专门针对 Java Web 应用，不依赖反编译即可静态分析 JAR 包内的配置文件 (Spring Boot 配置、数据库密码、API Key)。
- **Docker/K8s**: 针对容器环境的取证支持（识别容器列表、挂载点等）。

### 3.3 可视化思维过程 (Visualized Thinking Process)

创新性地将 Agent 的思考过程可视化：

- **UI 展示**: 用户能清晰看到 Agent 的三个步骤：
  1.  **Thinking (思考)**: 分析当前线索，决定下一步动作。
  2.  **Tool Execution (执行)**: 展示具体的 Shell/SQL 命令（如 `grep "Accepted" /var/log/secure`）。
  3.  **Observation (观察)**: 展示命令返回的原始结果。
- **价值**: 解决了大模型 "黑盒" 问题，让取证人员可以验证 AI 的判断逻辑，确保证据的可解释性。

### 3.4 沉浸式体验 (User Experience)

- **星空模式 (Starry Sky Mode)**: 独特的 UI 主题，提供沉浸式的工作环境。
- **数据表格化**: 自动将数据库查询结果渲染为交互式表格，支持排序和筛选。

### 3.5 一体化运维工具链 (Integrated Operations Toolkit)

为了提供无缝的取证体验，项目内置了完整的运维工具栈，替代了传统的 "Navicat + Xshell + Xftp" 多工具组合，实现了工具的闭环：

- **FUXI SQL (数据库管理)**:
  - 内置 `MySQLManager` 模块，支持多连接管理与 SSH 隧道连接。
  - 提供可视化的 SQL 编辑器 (基于 `Monaco Editor`)，支持 SQL 语法高亮与智能提示 (Auto-completion)。
  - **AI 增强**: 集成 "AI SQL Generator"，可根据自然语言生成复杂的 SQL 查询语句。
  - 支持表数据浏览、分页查询及结果导出。
- **FUXI Terminal (终端仿真)**:
  - 基于 `Xterm.js` 和 Rust `ssh2` 实现的高性能 Web 终端。
  - 支持多会话管理、自动重连、自定义主题及字体配置。
  - 深度集成：终端与文件管理器联动，提供流畅的命令行操作体验。
- **FUXI FTP (文件传输)**:
  - 全功能 SFTP 客户端，支持文件/文件夹的上传、下载、删除与重命名。
  - **在线编辑**: 内置文本编辑器和 **Hex 编辑器**，可直接在线修改配置文件或分析二进制文件头，无需下载到本地。
  - 支持拖拽上传与右键菜单操作，还原原生桌面软件体验。

## 4. 创新点与毕设亮点 (Innovation Points)

### 4.1 基于 MCP 理念的工具增强 (MCP-based Tool Enhancement)

- **概念落地**: 虽然不完全依赖官方 SDK，但项目完美实践了 **Model Context Protocol (MCP)** 的核心思想——将 "服务器环境" 抽象为一组可被 LLM 调用的 "工具" (Tools) 和 "资源" (Resources)。
- **工具解耦**: `run_shell_command`, `run_sql`, `analyze_jar` 等功能被封装为标准工具描述，任何兼容的大模型均可即插即用。
- **上下文管理**: Agent 能够自动将发现的关键信息（如数据库密码）保存到全局上下文 (`update_context_info`)，供后续分析使用，模拟了人类取证专家的 "案件笔记"。

### 4.2 "Deep Forensic Mode" (深度取证模式)

- **提示词工程创新**: 设计了复杂的 System Prompt，强制模型进入 "分析-执行-反馈" 的严格循环。
- **防幻觉机制**: 要求模型必须先用 `cat/ls` 看到文件存在，才能进行分析；必须先 `get_schema` 看到表结构，才能写 SQL。这极大降低了 LLM 在专业领域瞎编乱造的风险。

### 4.3 零侵入式取证 (Agentless Forensics)

- **现场保护**: 不同于在服务器上安装 Python/Go 脚本的传统方式，本工具运行在取证人员的本地电脑上，通过 SSH 协议进行无痕操作。
- **只读原则**: 系统严格限制了破坏性命令（如 `rm`, `drop`），并优先使用 `grep`, `cat` 等只读命令，符合电子数据取证的完整性要求。

### 4.4 异构数据融合分析

- **跨域关联**: 能够结合 "系统日志" (Linux Agent) 和 "数据库记录" (Database Agent) 进行关联分析。例如：从 Linux 日志发现异常 IP 登录，再到数据库中查询该 IP 是否有敏感操作记录。

---

## 5. 总结 (Conclusion)

本项目是一个集成了 **Rust 高性能后端**、**React 现代化前端** 以及 **前沿 LLM Agent 技术** 的综合性取证平台。它不仅是一个工具集，更是一个虚拟的 "数字取证专家助手"。通过 MCP 模式的引入，它让大模型真正落地到了网络安全取证这一垂直领域，显著提升了案件分析的效率与准确性，具有较高的学术价值与实用前景。
