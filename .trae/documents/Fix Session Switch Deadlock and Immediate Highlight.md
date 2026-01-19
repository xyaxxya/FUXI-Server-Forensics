## 根因判断（为什么“点击完全没反应/高亮不变”）
- 前端 `switchSession` 目前在 `await invoke('switch_session')` 之后才做本地状态更新；如果后端 IPC 卡住（不返回），前端就永远不会进入“更新高亮”的代码路径。
- 后端 `src-tauri/src/lib.rs` 存在典型的互斥锁顺序不一致：
  - `exec_command / batch_exec_command / exec_command_stream`：先锁 `current_session_id`，再锁 `sessions`
  - `list_sessions / switch_session / connect_ssh`：先锁 `sessions`，再锁 `current_session_id`
  - `disconnect_ssh` 还会在持有 `sessions` 的时候再次锁 `current_session_id`
- 当监控定时刷新（不断调用 `exec_command`）与点击切换（`switch_session`）并发发生时，就可能出现死锁：双方互相等待对方释放另一把锁，导致 `invoke('switch_session')` 卡住，从而出现“点击没有任何高亮变化”。

## 修复目标
- 点击任意服务器（包括新建）立即高亮。
- 后端切换会话不再卡住，`invoke('switch_session')` 能稳定返回。
- 切换失败时能够自动回滚/同步到后端真实状态。

## 代码修改计划
### 1) 后端：统一锁顺序 / 避免嵌套锁
修改 [lib.rs](file:///e:/fuxi/FUXI-Server-Forensics/src-tauri/src/lib.rs)：
- `list_sessions`：先读取并克隆 `current_session_id`，释放锁；再锁 `sessions` 生成列表（不再同时持有两把锁）。
- `switch_session`：先锁 `sessions` 仅用于 `contains_key` 检查，立刻释放；再锁 `current_session_id` 更新。
- `connect_ssh`：插入 `sessions` 后释放锁；再更新 `current_session_id`。
- `disconnect_ssh`：在持有 `sessions` 期间不再去锁 `current_session_id`；需要的 next_current 在 `sessions` 锁内算好，释放后再更新 `current_session_id`。

### 2) 前端：切换时先做乐观高亮，再等待后端确认
修改 [CommandContext.tsx](file:///e:/fuxi/FUXI-Server-Forensics/src/store/CommandContext.tsx)：
- `switchSession(sessionId)` 内：把 `setSessions` / `setCurrentSession` 的乐观更新提前到 `invoke('switch_session')` 之前，保证“点一下立刻高亮”。
- `invoke` 失败时：调用 `updateSessions()` 回滚到后端真实状态，并把错误抛出给 UI（侧边栏已有 catch）。

### 3) 验证方案（以测试员视角）
- 场景 A：关闭监控时切换，多次快速点击不同服务器，高亮与后端当前会话一致。
- 场景 B：开启监控（定时刷新）时切换，多次快速点击不同服务器，确认不再出现卡住与高亮不变。
- 场景 C：新建服务器连接成功后，立即点击新服务器与旧服务器交替切换，确认新服务器也可高亮与进入 Active。
- 以 `tauri dev` 运行，观察切换是否返回、UI 是否即时变化。

我会按以上步骤改完后端与前端，并通过上述 3 个场景验证，确保问题彻底解决。