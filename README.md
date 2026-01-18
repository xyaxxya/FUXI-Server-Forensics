# FUXI Server Forensics 🥷💻

**FUXI Server Forensics** 是一款基于 **Tauri**、**Rust** 和 **React** 构建的尖端赛博朋克风格服务器分析与取证工具。专为速度和隐蔽性设计，它提供了一个透明的“抬头显示器”（HUD）界面，悬浮在您的桌面之上，让您即时了解远程服务器的状态，而不会干扰您的工作空间。

![FUXI Server Forensics](https://via.placeholder.com/800x450.png?text=FUXI+Server+Forensics+HUD)

## ✨ 主要功能

- **🪟 透明 HUD 界面**：无边框、透明的窗口设计，与您的桌面工作流无缝融合。
- **🔌 模块化插件架构**：可扩展的系统，包含各类专业插件：
  - **系统**：CPU、内存、磁盘、负载平均值监控。
  - **网络**：活动端口、连接、带宽使用情况分析。
  - **安全**：认证日志、最后登录分析、可疑活动检测。
  - **Docker & K8s**：容器状态、镜像、Pods 和节点管理。
  - **数据库**：MySQL、Redis、Postgres 快速健康检查。
  - **Web**：Nginx/Apache 状态、宝塔 (BT) 面板集成。
- **⚡ 高性能 Rust 后端**：由 Tauri 和 SSH2 驱动，确保远程执行的安全与极速。
- **🎥 AAA 级开场动画**：包含“黑客帝国”风格特效和系统诊断的电影级启动序列。
- **🛠️ 一键取证**：瞬间执行复杂的诊断命令。

## 🚀 技术栈

- **核心**：[Rust](https://www.rust-lang.org/) (Tauri v2)
- **前端**：React 19, TypeScript, Vite
- **UI/UX**：Tailwind CSS v4, Framer Motion (动画), Lucide Icons
- **通信**：SSH2 (Rust Crate)

## 📦 安装与设置

1.  **先决条件**：
    - Node.js (v18+)
    - Rust (最新稳定版)
    - Visual Studio Build Tools (Windows) 或 Xcode (macOS)

2.  **克隆仓库**：

    ```bash
    git clone https://github.com/yourusername/FUXI-Server-Forensics.git
    cd FUXI-Server-Forensics
    ```

3.  **安装依赖**：

    ```bash
    npm install
    ```

4.  **运行开发模式**：

    ```bash
    npm run tauri dev
    ```

5.  **构建生产版本**：
    ```bash
    npm run tauri build
    ```

## 🧩 插件开发

FUXI Server Forensics 使用强类型的插件系统。添加新插件的步骤如下：

1. 在 `src/plugins/` 目录下创建一个新的 `.ts` 文件。
2. 实现 `PluginCommand` 接口。
3. 定义命令、解析器和 UI 表现形式。
4. 导出并注册插件。

## 📄 许可证

MIT License.
