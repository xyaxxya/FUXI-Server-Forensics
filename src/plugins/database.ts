/**
 * 插件名称: Database Plugin
 * 功能描述: 数据库服务检测与管理插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (database)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { Database, FileText } from 'lucide-react';
import { PluginCommand } from './types';

export const databaseCommands: PluginCommand[] = [
  { 
    id: 'db_services', 
    category: 'database', 
    name: 'Detected Services', 
    cn_name: '已检测服务', 
    description: 'Automatically detected running database services', 
    cn_description: '自动检测运行中的常见数据库服务', 
    // 使用 ps 命令查找常见数据库进程
    command: "ps -eo user,comm | grep -E 'mysql|mariadb|postgres|redis|mongo' | grep -v grep | sort | uniq | awk '{print $1 \"|\" $2}'", 
    icon: Database, 
    parserType: 'simpleList', 
    parserArgs: ['User', 'Service'], 
    checkExists: true 
  },
  { 
    id: 'mysql_pkg', 
    category: 'database', 
    name: 'MySQL Package', 
    cn_name: 'MySQL 包信息', 
    description: 'Installed MySQL/MariaDB package info', 
    cn_description: '已安装的 MySQL/MariaDB 软件包', 
    command: "if command -v rpm >/dev/null 2>&1 && rpm -qa | grep -qi mysql; then rpm -qa | grep -i mysql; elif command -v dpkg >/dev/null 2>&1 && dpkg -l | grep -qiE 'mysql|mariadb'; then dpkg -l | grep -iE 'mysql|mariadb'; else echo 'MySQL Package Not Detected' >&2; exit 1; fi", 
    icon: Database, 
    checkExists: true
  },
  { 
    id: 'mysql_svc', 
    category: 'database', 
    name: 'MySQL Service', 
    cn_name: 'MySQL 服务', 
    description: 'Status of the MySQL system service', 
    cn_description: 'MySQL 系统服务的当前状态', 
    command: "if command -v mysql >/dev/null 2>&1 || rpm -qa | grep -q mysql; then chkconfig --list mysqld 2>/dev/null || systemctl list-unit-files | grep mysql; else echo 'MySQL Service Not Detected' >&2; exit 1; fi", 
    icon: Database, 
    checkExists: true
  },
  { 
    id: 'redis_ver', 
    category: 'database', 
    name: 'Redis Version', 
    cn_name: 'Redis 版本', 
    description: 'Installed Redis server version', 
    cn_description: '已安装的 Redis 服务器版本', 
    command: "if command -v redis-cli >/dev/null 2>&1; then redis-cli -v; else echo 'Redis Not Detected' >&2; exit 1; fi", 
    icon: Database, 
    checkExists: true
  },
  { 
    id: 'mongo_ver', 
    category: 'database', 
    name: 'MongoDB Version', 
    cn_name: 'MongoDB 版本', 
    description: 'Installed MongoDB server version', 
    cn_description: '已安装的 MongoDB 服务器版本', 
    command: "if command -v mongod >/dev/null 2>&1; then mongod --version; else echo 'MongoDB Not Detected' >&2; exit 1; fi", 
    icon: Database, 
    checkExists: true
  },
  { 
    id: 'mysql_conf', 
    category: 'database', 
    name: 'MySQL Config', 
    cn_name: 'MySQL 配置', 
    description: 'MySQL configuration file preview', 
    cn_description: 'MySQL 配置文件预览', 
    command: "if command -v mysql >/dev/null 2>&1 || command -v mariadb >/dev/null 2>&1; then CFG=$(find /etc /usr/local/etc -name 'my.cnf' 2>/dev/null | head -n 1); if [ -n \"$CFG\" ]; then cat \"$CFG\"; else echo 'MySQL Config Not Detected' >&2; exit 1; fi; else echo 'MySQL Config Not Detected' >&2; exit 1; fi", 
    icon: FileText
  },
  { 
    id: 'redis_conf', 
    category: 'database', 
    name: 'Redis Config', 
    cn_name: 'Redis 配置', 
    description: 'Redis configuration file preview', 
    cn_description: 'Redis 配置文件预览', 
    command: "if command -v redis-cli >/dev/null 2>&1; then cat /etc/redis.conf | grep -v '^#' | grep -v '^$'; else echo 'Redis Config Not Detected' >&2; exit 1; fi", 
    icon: FileText, 
    checkExists: true
  },
  { 
    id: 'db_slow_log', 
    category: 'database', 
    name: 'Database Slow Log', 
    cn_name: '数据库慢日志', 
    description: 'Recent slow query and database error logs', 
    cn_description: '近期慢查询与数据库错误日志', 
    command: "find /var/log /var/lib/mysql /var/lib/postgresql -type f \\( -name '*slow*.log*' -o -name '*mysql*error*.log*' -o -name '*postgresql*.log*' -o -name '*mongodb*.log*' \\) 2>/dev/null | head -n 12 | xargs -r tail -n 120", 
    icon: FileText, 
    checkExists: true
  },
  { 
    id: 'db_permission_matrix', 
    category: 'database', 
    name: 'DB Permission Matrix', 
    cn_name: '数据库权限矩阵', 
    description: 'User and auth plugin matrix for MySQL/PostgreSQL/Redis', 
    cn_description: 'MySQL/PostgreSQL/Redis 用户与认证矩阵', 
    command: "echo '[MySQL]'; mysql -N -e \"select user,host,plugin from mysql.user\" 2>/dev/null || echo 'MySQL not available'; echo '[PostgreSQL]'; psql -Atqc \"select usename,usesuper,usecreatedb from pg_user\" 2>/dev/null || echo 'PostgreSQL not available'; echo '[Redis]'; redis-cli CONFIG GET requirepass 2>/dev/null || echo 'Redis not available'", 
    icon: Database, 
    checkExists: true
  }
];
