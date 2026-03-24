# 自动清理痕迹功能总结

## 🎯 核心实现

### 连接时（自动）
```rust
// 记录基线
initial_history_count = wc -l < ~/.bash_history  // 如 100 行
connect_timestamp = "Mar 24 10:30"               // 连接时间
```

### PTY 终端启动时（自动）
```bash
unset HISTFILE; export HISTSIZE=0; export HISTFILESIZE=0
```

### 断开连接时（自动）
```bash
# 1. 只删除本次新增的历史（101-150 行）
sed -i '101,$d' ~/.bash_history

# 2. 只删除本次连接的日志
sudo sed -i '/Mar 24 10:30.*root.*192.168.1.100/d' /var/log/auth.log
```

---

## ✅ 效果

| 项目 | 清理前 | 清理后 |
|------|--------|--------|
| bash_history | 150 行（100 旧 + 50 新） | 100 行（只保留旧的） |
| auth.log | 包含本次连接记录 | 只删除本次，保留其他 |
| 其他用户 | 不受影响 | 不受影响 |

---

## ⚠️ 注意事项

1. **需要 root 权限**：清理 auth.log 需要 sudo
2. **auditd 仍会记录**：如果启用了审计系统
3. **网络流量无法清理**：建议使用代理

---

## 🚀 使用方法

**完全自动，无需任何操作！**

1. 连接服务器 → 自动记录基线
2. 执行取证 → PTY 自动禁用历史
3. 断开连接 → 自动清理痕迹

就这么简单。
