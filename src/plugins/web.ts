/**
 * 插件名称: Web Plugin
 * 功能描述: Web 服务与宝塔面板检测插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (web)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { LayoutDashboard, Lock, Shield, Database, Server, FileText } from 'lucide-react';
import { PluginCommand } from './types';

export const webCommands: PluginCommand[] = [
  { 
    id: 'bt_domain', 
    category: 'web', 
    name: 'Baota Domains', 
    cn_name: '宝塔域名', 
    description: 'Domains configured in Baota panel', 
    cn_description: '宝塔面板配置的域名列表', 
    command: "if [ -f /www/server/panel/data/domain.conf ]; then cat /www/server/panel/data/domain.conf; else echo 'Baota Domains Not Detected'; fi", 
    icon: LayoutDashboard, 
    checkExists: true 
  },
  { 
    id: 'bt_auth', 
    category: 'web', 
    name: 'Baota Basic Auth', 
    cn_name: '宝塔认证', 
    description: 'Basic authentication settings for Baota', 
    cn_description: '宝塔面板的基础认证设置', 
    command: "if [ -f /www/server/panel/config/basic_auth.json ]; then cat /www/server/panel/config/basic_auth.json; else echo 'Baota Basic Auth Not Detected'; fi", 
    icon: Lock, 
    checkExists: true 
  },
  { 
    id: 'bt_limit', 
    category: 'web', 
    name: 'Baota IP Limit', 
    cn_name: '宝塔 IP 限制', 
    description: 'IP access limits configured in Baota', 
    cn_description: '宝塔面板配置的访问 IP 限制', 
    command: "if [ -f /www/server/panel/data/limitip.conf ]; then cat /www/server/panel/data/limitip.conf; else echo 'Baota IP Limit Not Detected'; fi", 
    icon: Shield, 
    checkExists: true 
  },
  { 
    id: 'bt_user', 
    category: 'web', 
    name: 'Baota User Info', 
    cn_name: '宝塔用户', 
    description: 'User information from Baota panel', 
    cn_description: '宝塔面板的用户信息', 
    command: "if [ -f /www/server/panel/data/userInfo.json ]; then cat /www/server/panel/data/userInfo.json; else echo 'Baota User Info Not Detected'; fi", 
    icon: LayoutDashboard, 
    checkExists: true 
  },
  { 
    id: 'bt_backup', 
    category: 'web', 
    name: 'Baota Backup Time', 
    cn_name: '宝塔备份', 
    description: 'Last backup timestamps for sites', 
    cn_description: '站点最近的备份时间戳', 
    command: "if [ -d /www/backup/site/ ]; then ls -l --time-style=full-iso /www/backup/site/; else echo 'Baota Backup Not Detected'; fi", 
    icon: Database, 
    parserType: 'lsOutput', 
    checkExists: true 
  },
  { 
    id: 'nginx_pkg', 
    category: 'web', 
    name: 'Nginx Package', 
    cn_name: 'Nginx 包信息', 
    description: 'Installed Nginx package information', 
    cn_description: '已安装的 Nginx 软件包信息', 
    command: "if command -v rpm >/dev/null 2>&1 && rpm -qa | grep -q nginx; then rpm -qa | grep nginx; else echo 'Nginx Package Not Detected'; fi", 
    icon: Server, 
    checkExists: true 
  },
  { 
    id: 'nginx_info', 
    category: 'web', 
    name: 'Nginx Info', 
    cn_name: 'Nginx 版本', 
    description: 'Nginx version and build details', 
    cn_description: 'Nginx 的版本与编译参数', 
    command: "if command -v nginx >/dev/null 2>&1; then nginx -V; else echo 'Nginx Not Detected'; fi", 
    icon: Server, 
    checkExists: true 
  },
  { 
    id: 'nginx_conf', 
    category: 'web', 
    name: 'Nginx Config', 
    cn_name: 'Nginx 配置', 
    description: 'Nginx configuration file preview', 
    cn_description: 'Nginx 配置文件头部预览', 
    command: "if command -v nginx >/dev/null 2>&1; then nginx -T | head -n 100; else echo 'Nginx Config Not Detected'; fi", 
    icon: FileText, 
    checkExists: true, 
    parserType: 'raw' 
  },
  { 
    id: 'apache_conf', 
    category: 'web', 
    name: 'Apache Config', 
    cn_name: 'Apache 配置', 
    description: 'Apache configuration file location', 
    cn_description: 'Apache httpd.conf 配置文件位置', 
    command: "if [ -d /etc/httpd/ ]; then find /etc/httpd/ -name httpd.conf; else echo 'Apache Config Not Detected'; fi", 
    icon: FileText, 
    checkExists: true 
  }
];
