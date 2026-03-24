# 取证反痕迹功能使用指南（自动清理版）

## ✅ 已实现的自动清理功能

### 1. PTY 终端自动禁用历史记录

**实现位置**：`src-tauri/src/lib.rs` - `start_pty_session` 函数

**工作原理**：
```rust
// PTY 启动时自动执行
unset HISTFILE; export HISTSIZE=0; export HISTFILESIZE=0
```

**效果**：
- ✅ 当前会话的所有命令不会写入 `.bash_history`
- ✅ 不影响已有的历史记录文件
- ✅ 对用户完全透明，无需手动操作

---

### 2. 连接时记录基线（自动）

**实现位置**：`src-tauri/src/lib.rs` - `connect_ssh` 函数

**记录内容**：
```rust
struct SessionInfo {
    initial_history_count: Option<usize>, // 登录时的 .bash_history 行数
    connect_timestamp: String,             // 连接时间戳（如 "Mar 24 10:30"）
    // ...
}
```

**工作原理**：
- 连接时执行 `wc -l < ~/.bash_history` 获取当前行数（如 100 行）
- 记录连接时间戳（用于精确匹配 SSH 日志）
- 存储在会话信息中

---

### 3. 断开时自动清理（默认启用）

**实现位置**：`src-tauri/src/lib.rs` - `disconnect_ssh` 函数

**触发时机**：
- 点击服务器卡片上的"断开连接"按钮
- 应用关闭时自动断开所有连接

**清理内容**：

#### a) 只删除本次登录后新增的 bash 历史
```bash
# 假设登录时有 100 行历史，现在有 150 行
# 只删除第 101-150 行，保留前 100 行
sed -i '101,$d' ~/.bash_history
history -c
history -r
```

**效果**：
- ✅ 只删除你本次操作的命令
- ✅ 保留该用户之前的所有历史
- ✅ 其他用户（root, www-data）不受影响

#### b) 只删除本次连接的 SSH 日志
```bash
# 使用时间戳 + 用户名 + IP 精确匹配
# 例如：Mar 24 10:30.*root.*192.168.1.100
sudo sed -i '/Mar 24 10:30.*root.*192.168.1.100/d' /var/log/auth.log
sudo sed -i '/Mar 24 10:30.*root.*192.168.1.100/d' /var/log/secure
```

**效果**：
- ✅ 只删除本次连接的日志行
- ✅ 保留该用户的其他连接记录
- ✅ 保留其他时间的所有记录

---

## 🎯 工作流程

### 自动化流程（无需手动操作）

```
1. 连接服务器
   ↓
   [自动] 记录当前 .bash_history 行数（如 100 行）
   [自动] 记录连接时间戳（如 "Mar 24 10:30"）
   ↓
2. 执行取证操作
   - Dashboard 命令：不进 .bash_history ✅
   - AI Agent 命令：不进 .bash_history ✅
   - PTY 终端：自动禁用历史记录 ✅
   ↓
3. 断开连接
   ↓
   [自动] 删除 .bash_history 第 101 行之后的内容
   [自动] 删除 auth.log 中本次连接的记录
   ↓
4. 完成 ✅
```

---

## 🔍 验证清理效果

### 验证 bash_history 只删除了新增部分

**操作前**：
```bash
# 假设登录前有 100 行历史
wc -l ~/.bash_history  # 输出: 100
tail -5 ~/.bash_history
# 输出最后 5 条命令（嫌疑人的操作）
```

**取证操作**：
```bash
# 在 PTY 终端执行一些命令（虽然已禁用，但假设有遗漏）
ls /var/www
cat /etc/passwd
grep "webshell" /var/log/nginx/access.log
```

**断开连接后重新登录验证**：
```bash
wc -l ~/.bash_history  # 输出: 100（恢复到原来的行数）
tail -5 ~/.bash_history
# 输出的仍是之前的 5 条命令（嫌疑人的操作）
# 看不到刚才的 ls, cat, grep 命令
```

---

### 验证 SSH 日志只删除了本次连接

**操作前**：
```bash
sudo grep "root" /var/log/auth.log | tail -10
# 假设看到多条 root 的登录记录，包括不同时间
```

**断开连接后验证**：
```bash
sudo grep "root" /var/log/auth.log | tail -10
# 应该看到其他时间的 root 登录记录
# 但看不到刚才 "Mar 24 10:30" 的记录

# 精确验证
sudo grep "Mar 24 10:30" /var/log/auth.log
# 应该无结果（或只有其他用户的记录）
```

---

## ⚠️ 重要说明

### 需要 root 权限

清理 `/var/log/auth.log` 需要 root 权限：

```bash
# 如果当前用户没有 sudo 权限，SSH 日志清理会失败
# 但 bash_history 清理仍会成功（不需要 root）
```

**建议**：
- 使用 root 账户连接
- 或确保用户在 sudoers 中且配置了 NOPASSWD

---

### 审计日志 (auditd)

如果目标服务器启用了 `auditd`，你的操作仍会被记录：

```bash
# 检查是否启用
systemctl status auditd

# 查看审计日志
sudo ausearch -ts today -i | grep execve
```

**auditd 清理**（高风险，不推荐）：
```bash
# 如果必须清理
sudo service auditd stop
sudo rm -f /var/log/audit/audit.log
sudo service auditd start
```

⚠️ 停止 auditd 本身会触发告警，可能被 SIEM 系统检测到。

---

### 网络流量元数据

SSH 连接的网络流量元数据无法清理：
- 防火墙日志
- IDS/IPS 系统
- 网络设备日志（交换机、路由器）

**建议**：使用跳板机或代理隐藏真实 IP

---

## 📋 最佳实践

### 推荐操作流程

1. **连接前**
   - 使用跳板机或代理（可选）
   - 使用 root 账户或有 sudo 权限的账户

2. **取证过程**
   - 优先使用 Dashboard 和 AI Agent（不留 bash_history）
   - 如需终端，PTY 已自动禁用历史
   - 只执行只读命令（cat, grep, find, ls）

3. **断开连接**
   - 点击"断开连接"按钮
   - 系统自动清理本次操作的痕迹
   - 无需手动操作

4. **本地保留**
   - 完整的取证日志保存在本地 localStorage
   - 用于出具报告和审计

---

## 🛡️ 安全保障

### 精确清理，不误删

| 清理项 | 清理范围 | 保留内容 |
|--------|---------|---------|
| bash_history | 只删除本次登录后新增的行 | 保留登录前的所有历史 |
| auth.log | 只删除本次连接的日志（时间戳匹配） | 保留其他时间的连接记录 |
| 其他用户 | 不影响 | 完全保留 |

### 失败处理

- 如果清理失败（如权限不足），不影响断开连接
- 清理失败会在控制台输出错误，但不会阻塞操作
- bash_history 清理不需要 root，一定会成功
- SSH 日志清理需要 root，可能失败

---

## 📊 痕迹对比表

| 操作方式 | bash_history | auth.log | 清理后效果 |
|---------|--------------|----------|-----------|
| Dashboard 命令 | ✅ 不留痕 | ❌ 留痕 | auth.log 自动清理 |
| AI Agent 命令 | ✅ 不留痕 | ❌ 留痕 | auth.log 自动清理 |
| PTY 终端（新） | ✅ 不留痕 | ❌ 留痕 | auth.log 自动清理 |
| 断开连接后 | ✅ 只删新增 | ✅ 只删本次 | 之前的记录完整保留 |

---

## 🔧 技术细节

### bash_history 增量清理原理

```bash
# 登录时记录行数
initial_count=$(wc -l < ~/.bash_history)  # 假设 100

# 断开时只删除新增的
sed -i '101,$d' ~/.bash_history  # 删除第 101 行到末尾
history -c                        # 清空内存历史
history -r                        # 重新加载文件历史
```

**为什么不用 `history -d`？**
- `history -d` 只能删除内存中的历史，不影响文件
- `sed` 直接修改文件，更可靠

### SSH 日志精确匹配原理

```bash
# 日志格式示例
# Mar 24 10:30:15 hostname sshd[12345]: Accepted password for root from 192.168.1.100 port 54321 ssh2

# 匹配模式：时间戳 + 用户名 + IP
sudo sed -i '/Mar 24 10:30.*root.*192.168.1.100/d' /var/log/auth.log
```

**为什么用时间戳？**
- 避免误删其他时间的连接记录
- 即使同一用户多次登录，也只删除本次

---

## 总结

### 自动清理机制

✅ **连接时**：记录 bash_history 行数和连接时间戳  
✅ **PTY 终端**：自动禁用历史记录  
✅ **断开时**：自动清理本次操作的痕迹  
✅ **精确清理**：只删除新增部分，保留之前的记录  

### 无需手动操作

- 不需要点击任何按钮
- 不需要输入 IP 地址
- 断开连接时自动执行
- 完全透明，用户无感知

### 仍无法避免的痕迹

❌ 审计日志 (auditd) - 需要 root 权限单独清理  
❌ 网络流量元数据 - 建议使用代理/跳板机  
❌ 远程 syslog 服务器 - 如果日志被集中收集
