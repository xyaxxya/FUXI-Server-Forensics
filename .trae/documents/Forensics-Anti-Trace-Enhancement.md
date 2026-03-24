# 远程服务器取证痕迹分析与对策

## 当前系统痕迹评估

### ✅ 已做好的部分

1. **AI Agent 命令执行**（不留 bash_history）
   - 使用 `channel_session()` + `exec()` 非交互式执行
   - 命令不会进入 `.bash_history`
   - 执行后立即关闭 channel

2. **手动命令执行**（Dashboard 面板）
   - 同样使用非交互式 `exec_command`
   - 不创建持久化 shell 会话

### ⚠️ 存在风险的部分

1. **PTY 终端模式**（TerminalXterm 组件）
   - 使用 `request_pty()` + `shell()` 创建交互式 shell
   - **会进入 `.bash_history`**
   - 完整的 shell 会话记录

2. **无法避免的系统级痕迹**
   - SSH 连接日志：`/var/log/auth.log` 记录 IP、时间、用户
   - 审计日志：如果启用 `auditd`，所有命令都会被记录
   - 网络流量：防火墙/IDS 记录连接元数据

---

## 🛡️ 减少远程服务器痕迹的方案

### 方案 1：禁用 PTY 终端（推荐）

**问题**：PTY 终端会留下 `.bash_history`

**解决**：
- 在取证场景下，完全禁用 `TerminalXterm` 组件
- 所有操作通过 Dashboard 面板或 AI Agent 执行
- 这些都使用非交互式 `exec_command`，不留 bash_history

**实现**：添加取证模式开关，隐藏终端入口

```typescript
// src/App.tsx 或配置文件
interface AppConfig {
  forensicsMode: boolean; // 取证模式
}

// 在 forensicsMode 下隐藏终端按钮
{!forensicsMode && <TerminalButton />}
```

---

### 方案 2：PTY 终端自动禁用历史记录

如果必须使用终端，在 PTY 启动时自动执行：

```rust
// src-tauri/src/lib.rs - start_pty_session 函数
channel.shell().map_err(|e| e.to_string())?;

// 立即发送禁用历史记录的命令
let disable_history = "unset HISTFILE; export HISTSIZE=0; export HISTFILESIZE=0; clear\n";
channel.write_all(disable_history.as_bytes()).map_err(|e| e.to_string())?;
```

**效果**：
- 当前会话的命令不会写入 `.bash_history`
- 用户看不到这些命令（已 clear）
- 退出后不留痕迹

---

### 方案 3：使用跳板机/代理

**问题**：SSH 日志会记录你的真实 IP

**解决**：
- 使用项目已支持的 SOCKS5/HTTP 代理功能
- 或通过跳板机连接（先 SSH 到跳板机，再从跳板机连接目标）

**优势**：
- 目标服务器日志显示的是跳板机 IP
- 隐藏取证人员的真实来源

**你的代码已支持**：
```typescript
// Login.tsx 已有代理配置
interface ProxyConfig {
  type: 'direct' | 'socks5' | 'http';
  host: string;
  port: number;
  username?: string;
  password?: string;
}
```

---

### 方案 4：只读命令白名单（推荐）

**目的**：确保不修改目标系统，保护现场完整性

**实现**：在 AI Agent 和手动执行前验证命令

```typescript
// src/lib/commandValidator.ts
const READ_ONLY_COMMANDS = new Set([
  'cat', 'grep', 'find', 'ls', 'head', 'tail',
  'less', 'more', 'stat', 'file', 'strings',
  'ps', 'netstat', 'ss', 'lsof', 'who', 'w',
  'last', 'lastlog', 'history', 'df', 'du',
  'awk', 'sed', 'cut', 'sort', 'uniq', 'wc'
]);

export function validateForensicsCommand(cmd: string): {
  valid: boolean;
  reason?: string;
} {
  const firstWord = cmd.trim().split(/\s+/)[0];
  
  if (!READ_ONLY_COMMANDS.has(firstWord)) {
    return {
      valid: false,
      reason: `命令 "${firstWord}" 不在只读白名单中`
    };
  }
  
  // 检查危险参数（即使是只读命令也可能有危险用法）
  const dangerous = ['rm ', 'dd ', '>', '>>', 'mkfifo', 'nc -l'];
  for (const pattern of dangerous) {
    if (cmd.includes(pattern)) {
      return {
        valid: false,
        reason: `命令包含危险操作: ${pattern}`
      };
    }
  }
  
  return { valid: true };
}
```

**集成到 AI Agent**：

```typescript
// src/lib/ai.ts - 在 run_shell_command 工具描述中添加
{
  type: "function",
  function: {
    name: "run_shell_command",
    description: "执行只读 Shell 命令。仅允许：cat, grep, find, ls, ps, netstat 等。禁止：rm, vi, nano, top, dd, 重定向(>)。",
    // ...
  }
}
```

---

### 方案 5：会话结束后清理（⚠️ 高风险）

**仅在授权的渗透测试场景使用，司法取证不推荐**

```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn cleanup_session_traces(
    state: State<'_, AppState>,
    session_id: String,
    forensics_ip: String, // 取证人员的 IP
) -> Result<String, String> {
    // 1. 清理 auth.log 中的连接记录
    let cleanup_auth = format!(
        "sudo sed -i '/{}/d' /var/log/auth.log /var/log/secure 2>/dev/null",
        forensics_ip
    );
    
    // 2. 清理 bash_history（如果用了 PTY）
    let cleanup_history = "history -c; rm -f ~/.bash_history; touch ~/.bash_history";
    
    // 3. 清理 lastlog
    let cleanup_lastlog = format!(
        "sudo lastlog -u {} -C 2>/dev/null",
        "当前用户" // 需要获取当前用户名
    );
    
    exec_command(state, cleanup_auth, Some(session_id.clone()), None).await?;
    exec_command(state, cleanup_history.to_string(), Some(session_id.clone()), None).await?;
    
    Ok("已清理 SSH 日志和命令历史".to_string())
}
```

**⚠️ 严重警告**：
- 修改日志违反取证完整性原则
- 可能被审计系统记录（清理行为本身）
- 需要 root 权限
- 可能在法庭上被质疑

---

## 📋 实施检查清单

### 当前系统状态

| 项目 | 状态 | 说明 |
|------|------|------|
| AI Agent 命令执行 | ✅ 安全 | 使用非交互式 `exec()`，不留 bash_history |
| Dashboard 手动命令 | ✅ 安全 | 同上 |
| PTY 终端 | ❌ 留痕 | 会进入 `.bash_history` |
| SSH 连接日志 | ❌ 无法避免 | `/var/log/auth.log` 必然记录 |
| 审计日志 (auditd) | ❌ 无法避免 | 如果目标启用，所有命令都会被记录 |

### 推荐配置（公安取证场景）

1. ✅ **禁用 PTY 终端**：只使用 Dashboard 和 AI Agent
2. ✅ **使用代理/跳板机**：隐藏真实 IP
3. ✅ **只读命令白名单**：防止误操作破坏现场
4. ⚠️ **记录取证过程**：在本地保留完整日志（用于出具报告）
5. ❌ **不清理远程日志**：保持证据完整性

---

## 🎓 取证最佳实践

### 司法取证原则

1. **完整性**：不修改目标系统
2. **可重复性**：操作可被第三方验证
3. **时间线**：明确区分嫌疑人操作和取证操作
4. **证据链**：保留完整的取证日志

### 操作建议

```bash
# ✅ 推荐：只读分析
cat /var/log/nginx/access.log | grep "POST /upload"
find /var/www -name "*.php" -mtime -7
grep -r "eval(" /var/www/html

# ❌ 避免：修改系统
rm suspicious_file.php          # 破坏证据
echo "" > /var/log/auth.log     # 篡改日志
chmod 777 /tmp                  # 修改权限
```

### 时间线区分

在取证报告中明确标注：

```
[2024-03-20 14:23:15] 嫌疑人操作：上传 webshell.php（来源：nginx access.log）
[2024-03-24 10:30:00] 取证操作：SSH 连接到服务器（来源：auth.log）
[2024-03-24 10:31:00] 取证操作：执行 find 命令查找可疑文件
```

---

## 总结

### 你的系统现状

✅ **AI Agent 和 Dashboard 命令执行**：
- 不会留下 `.bash_history`
- 命令执行后立即关闭 channel
- 符合取证要求

❌ **PTY 终端**：
- 会留下完整的交互式会话记录
- 建议在取证模式下禁用

⚠️ **无法避免的痕迹**：
- SSH 连接日志（`/var/log/auth.log`）
- 审计日志（如果启用 `auditd`）
- 建议使用跳板机隐藏真实 IP

### 推荐操作流程

1. 通过跳板机/代理连接目标服务器
2. 只使用 Dashboard 或 AI Agent 执行命令（不用终端）
3. 优先执行只读命令（cat, grep, find, ls）
4. 在本地保留完整的取证日志
5. 在报告中明确标注操作时间线

### 是否需要清理痕迹？

**司法取证**：❌ 不建议
- 保持证据完整性
- 你的操作本身也是证据链的一部分

**内部调查/应急响应**：⚠️ 视情况而定
- 如果需要隐蔽调查，可以考虑
- 但要评估法律风险
