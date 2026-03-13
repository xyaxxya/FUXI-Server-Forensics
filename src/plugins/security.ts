/**
 * 插件名称: Security Plugin
 * 功能描述: 系统安全与审计插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (security)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { Shield, Lock, Activity, FileText } from 'lucide-react';
import { PluginCommand } from './types';

export const securityCommands: PluginCommand[] = [
  { 
    id: 'priv_user', 
    category: 'security', 
    name: 'Privileged Users', 
    cn_name: '特权用户 (UID=0)', 
    description: 'Users with UID 0 (root privileges)', 
    cn_description: '拥有 UID 0 (Root 权限) 的用户列表', 
    command: "awk -F: '$3==0{print $1}' /etc/passwd", 
    icon: Shield 
  },
  { 
    id: 'remote_user', 
    category: 'security', 
    name: 'Remote Users', 
    cn_name: '远程登录用户', 
    description: 'Users allowed to login via SSH', 
    cn_description: '允许通过 SSH 远程登录的用户', 
    command: "ALLOW=$(grep -hsE '^AllowUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -n 1 | cut -d' ' -f2-); DENY=$(grep -hsE '^DenyUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | tail -n 1 | cut -d' ' -f2-); awk -F: '$7 !~ /(nologin|false)$/ {print $1}' /etc/passwd | while read u; do if [ -n \"$ALLOW\" ]; then echo \"$ALLOW\" | tr ' ' '\\n' | grep -Fxq \"$u\" || continue; fi; if [ -n \"$DENY\" ]; then echo \"$DENY\" | tr ' ' '\\n' | grep -Fxq \"$u\" && continue; fi; echo \"$u\"; done", 
    icon: Shield, 
    checkExists: true 
  },
  { 
    id: 'sudo_perm', 
    category: 'security', 
    name: 'Sudo Permissions', 
    cn_name: 'Sudo 权限', 
    description: 'Users with sudo privileges', 
    cn_description: '拥有 Sudo 权限的用户配置', 
    command: "grep -v \"^#\\|^$\" /etc/sudoers | grep \"ALL=(ALL)\"", 
    icon: Lock, 
    checkExists: true 
  },
  { 
    id: 'firewall_status', 
    category: 'security', 
    name: 'Firewall Status', 
    cn_name: '防火墙状态', 
    description: 'Current status of the system firewall', 
    cn_description: '当前系统防火墙的运行状态', 
    command: "if systemctl is-active --quiet firewalld 2>/dev/null; then systemctl status firewalld; elif command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q 'Status: active'; then sudo ufw status verbose; else echo 'Firewall Not Detected (No active firewalld or ufw found)'; fi", 
    icon: Shield 
  },
  { 
    id: 'cron_jobs', 
    category: 'security', 
    name: 'Cron Jobs', 
    cn_name: '定时任务', 
    description: 'Scheduled cron jobs for current user', 
    cn_description: '当前用户的定时任务列表 (Crontab)', 
    command: "crontab -l", 
    icon: Activity, 
    checkExists: true 
  },
  { 
    id: 'login_hist', 
    category: 'security', 
    name: 'Accepted Logins', 
    cn_name: '登录成功记录', 
    description: 'Recent successful SSH login attempts', 
    cn_description: '近期 SSH 登录成功的历史记录', 
    // 分析 secure 日志获取成功登录信息
    command: "LOG_FILES=$(ls /var/log/secure* /var/log/auth.log* 2>/dev/null); if [ -n \"$LOG_FILES\" ]; then cat $LOG_FILES 2>/dev/null | grep \"Accepted\" | sort -M | tail -n 20 | awk '{print} END {if (NR==0) print \"No accepted login records found\"}'; else echo \"No auth logs found\"; fi", 
    icon: FileText, 
    parserType: 'authLog' 
  },
  { 
    id: 'fail_login', 
    category: 'security', 
    name: 'Failed Logins', 
    cn_name: '登录失败记录', 
    description: 'Recent failed SSH login attempts', 
    cn_description: '近期 SSH 登录失败的历史记录', 
    command: "LOG_FILES=$(ls /var/log/secure* /var/log/auth.log* 2>/dev/null); if [ -n \"$LOG_FILES\" ]; then cat $LOG_FILES 2>/dev/null | grep \"Failed password\" | sort -M | tail -n 20 | awk '{print} END {if (NR==0) print \"No failed login attempts found\"}'; else echo \"No auth logs found\"; fi", 
    icon: Activity, 
    parserType: 'authLog' 
  },
  { 
    id: 'sudo_audit_log', 
    category: 'security', 
    name: 'Sudo Audit Log', 
    cn_name: 'Sudo 审计日志', 
    description: 'Recent sudo privilege escalation events', 
    cn_description: '近期 sudo 提权事件', 
    command: "LOG_FILES=$(ls /var/log/secure* /var/log/auth.log* 2>/dev/null); if [ -n \"$LOG_FILES\" ]; then grep -h 'sudo:' $LOG_FILES 2>/dev/null | tail -n 200; else echo 'No sudo audit logs found'; fi", 
    icon: FileText, 
    parserType: 'authLog' 
  },
  { 
    id: 'cron_audit_log', 
    category: 'security', 
    name: 'Cron Audit Log', 
    cn_name: 'Cron 审计日志', 
    description: 'Recent cron execution records', 
    cn_description: '近期 cron 执行记录', 
    command: "LOG_FILES=$(ls /var/log/cron* /var/log/syslog* /var/log/messages* 2>/dev/null); if [ -n \"$LOG_FILES\" ]; then grep -hEi 'CRON|crond' $LOG_FILES 2>/dev/null | tail -n 200; else echo 'No cron audit logs found'; fi", 
    icon: Activity, 
    parserType: 'authLog' 
  },
  { 
    id: 'system_error_log', 
    category: 'security', 
    name: 'System Error Log', 
    cn_name: '系统错误日志', 
    description: 'Recent system error and critical logs', 
    cn_description: '近期系统错误与严重级别日志', 
    command: "journalctl -p err..alert --since '24 hours ago' --no-pager | tail -n 300 || grep -hEi 'error|critical|panic|fatal' /var/log/messages* /var/log/syslog* 2>/dev/null | tail -n 300", 
    icon: FileText, 
    parserType: 'authLog' 
  },
  { 
    id: 'web_error_log', 
    category: 'security', 
    name: 'Web Error Log', 
    cn_name: 'Web 错误日志', 
    description: 'Recent web server error logs', 
    cn_description: '近期 Web 服务错误日志', 
    command: "find /var/log -type f \\( -name '*nginx*error*.log*' -o -name '*apache*error*.log*' -o -name '*httpd*error*.log*' \\) 2>/dev/null | head -n 10 | xargs -r tail -n 120", 
    icon: FileText, 
    parserType: 'authLog' 
  },
  { 
    id: 'db_error_log', 
    category: 'security', 
    name: 'Database Error Log', 
    cn_name: '数据库错误日志', 
    description: 'Recent database error and slow query logs', 
    cn_description: '近期数据库错误与慢查询日志', 
    command: "find /var/log /var/lib/mysql /var/lib/postgresql -type f \\( -name '*mysql*error*.log*' -o -name '*mariadb*error*.log*' -o -name '*postgresql*.log*' -o -name '*slow*.log*' -o -name '*mongodb*.log*' \\) 2>/dev/null | head -n 12 | xargs -r tail -n 100", 
    icon: FileText, 
    parserType: 'authLog' 
  }
];
