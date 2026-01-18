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
    command: "grep -E '^[^:]+:[^!*]' /etc/shadow | cut -d: -f1", 
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
    command: "cat /var/log/secure* 2>/dev/null | grep \"Accepted\" | sort -M | tail -n 20", 
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
    command: "cat /var/log/secure* 2>/dev/null | grep \"Failed password\" | sort -M | tail -n 20", 
    icon: Activity, 
    parserType: 'authLog' 
  }
];
