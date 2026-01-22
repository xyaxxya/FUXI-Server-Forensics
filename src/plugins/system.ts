/**
 * 插件名称: System Plugin
 * 功能描述: 操作系统基础信息检测插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (system)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { Server, Activity, Database } from 'lucide-react';
import { PluginCommand } from './types';

export const systemCommands: PluginCommand[] = [
  { 
    id: 'os_kernel', 
    category: 'system', 
    name: 'OS Kernel', 
    cn_name: '内核信息', 
    description: 'Shows basic kernel name and release version', 
    cn_description: '显示基础内核名称与版本号', 
    command: 'uname -sr', 
    icon: Server 
  },
  { 
    id: 'sys_uptime', 
    category: 'system', 
    name: 'System Uptime', 
    cn_name: '运行时间', 
    description: 'Shows how long the system has been running', 
    cn_description: '显示系统自上次启动以来的运行时间', 
    command: 'uptime -p', 
    icon: Activity 
  },
  { 
    id: 'linux_release', 
    category: 'system', 
    name: 'Linux Release', 
    cn_name: '发行版信息', 
    description: 'Standard Linux Standard Base (LSB) release information', 
    cn_description: '标准的 LSB 发行版信息', 
    command: 'lsb_release -a', 
    icon: Server 
  },
  { 
    id: 'redhat_release', 
    category: 'system', 
    name: 'RedHat Release', 
    cn_name: 'RedHat 版本', 
    description: 'RedHat/CentOS specific release file content', 
    cn_description: 'RedHat/CentOS 特定的发行版文件内容', 
    command: 'cat /etc/redhat-release', 
    icon: Server, 
    checkExists: true 
  },
  { 
    id: 'kernel_ver', 
    category: 'system', 
    name: 'Kernel Version', 
    cn_name: '内核详情', 
    description: 'Detailed kernel version information from /proc/version', 
    cn_description: '读取 /proc/version 获取的详细内核信息', 
    command: "cat /proc/version | cut -d' ' -f1-4", 
    icon: Server 
  },
  { 
    id: 'disk_usage', 
    category: 'system', 
    name: 'Disk Usage', 
    cn_name: '磁盘使用', 
    description: 'Disk space usage for all mounted filesystems', 
    cn_description: '所有挂载文件系统的磁盘空间使用情况', 
    // 格式化 df 输出以供解析器使用
    command: "df -h | awk 'NR>1 {print $1 \"|\" $2 \"|\" $3 \"|\" $4 \"|\" $5 \"|\" $6}'", 
    icon: Database, 
    parserType: 'disk' 
  },
  { 
    id: 'mem_status', 
    category: 'system', 
    name: 'Memory Status', 
    cn_name: '内存状态', 
    description: 'Total, used, and free memory statistics', 
    cn_description: '内存总量、已用量及空闲量统计', 
    command: "free -h | awk 'NR==2 {print \"TOTAL: \" $2 \" | USED: \" $3 \" | FREE: \" $4}'", 
    icon: Activity 
  },
  { 
    id: 'load_avg', 
    category: 'system', 
    name: 'Load Average', 
    cn_name: '系统负载', 
    description: 'System load average for 1, 5, and 15 minutes', 
    cn_description: '系统最近 1、5、15 分钟的平均负载', 
    command: "cat /proc/loadavg | awk '{print $1, $2, $3}'", 
    icon: Activity 
  },
  { 
    id: 'top_proc', 
    category: 'system', 
    name: 'Top Processes', 
    cn_name: 'CPU 占用 Top5', 
    description: 'Top 5 processes by CPU usage', 
    cn_description: '占用 CPU 最高的 5 个进程', 
    command: "ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu | head -n 6 | tail -n 5 | awk '{print $1 \"|\" $2 \"|\" $3 \"|\" $4 \"|\" $5}'", 
    icon: Server, 
    parserType: 'process' 
  },
  // 新增：CPU详细信息
  { 
    id: 'cpu_info', 
    category: 'system', 
    name: 'CPU Information', 
    cn_name: 'CPU 信息', 
    description: 'Detailed CPU information including model, cores, and speed', 
    cn_description: 'CPU 详细信息，包括型号、核心数和速度', 
    command: "lscpu | grep -E 'Model name|CPU\\(s\\):|CPU MHz|L3 cache' | awk -F: '{print $1\"|\"$2}' || grep -E 'model name|cpu cores|cpu MHz|cache size' /proc/cpuinfo | head -n 4 | awk -F: '{print $1\"|\"$2}'", 
    icon: Activity,
    parserType: 'simpleList',
    parserArgs: ['th_name', 'th_value']
  },
  // 新增：内存详细信息
  { 
    id: 'mem_detailed', 
    category: 'system', 
    name: 'Detailed Memory', 
    cn_name: '内存详情', 
    description: 'Detailed memory information including buffers and cache', 
    cn_description: '内存详细信息，包括缓冲区和缓存', 
    command: "free -h | awk 'NR==2{print \"Mem|\"$2\"|\"$3\"|\"$4\"|\"$5\"|\"$6\"|\"$7} NR==3{print \"Swap|\"$2\"|\"$3\"|\"$4\"|||\"}'", 
    icon: Activity,
    parserType: 'memory'
  },
  // 新增：交换分区使用情况
  { 
    id: 'swap_usage', 
    category: 'system', 
    name: 'Swap Usage', 
    cn_name: '交换分区使用', 
    description: 'Swap partition usage statistics', 
    cn_description: '交换分区使用情况统计', 
    command: "free -h | grep Swap | awk '{print \"Swap|\"$2\"|\"$3\"|\"$4\"|||\"}'", 
    icon: Activity,
    parserType: 'memory'
  },
  // 新增：系统进程统计
  { 
    id: 'process_stats', 
    category: 'system', 
    name: 'Process Statistics', 
    cn_name: '进程统计', 
    description: 'Total number of processes and their states', 
    cn_description: '进程总数及其状态分布', 
    command: "ps aux | wc -l && uptime | awk '{print $4, $5, $6}' && cat /proc/loadavg | awk '{print $4}'", 
    icon: Activity 
  },
  // 新增：网络接口流量
  { 
    id: 'net_traffic', 
    category: 'system', 
    name: 'Network Traffic', 
    cn_name: '网络流量', 
    description: 'Network interface traffic statistics', 
    cn_description: '网络接口流量统计', 
    command: "ifconfig | grep -E 'RX packets|TX packets' | head -n 4", 
    icon: Activity 
  },
  // 新增：开机启动项
  { 
    id: 'boot_services', 
    category: 'system', 
    name: 'Boot Services', 
    cn_name: '开机启动项', 
    description: 'Enabled system services on boot', 
    cn_description: '开机启用的系统服务', 
    command: "systemctl list-unit-files --type=service --state=enabled | head -n 20 | awk 'NR>1 && $1!=\"\" && $1!=\"UNIT\" {print $1\"|\"$2\"|\"$3}'", 
    icon: Server, 
    checkExists: true,
    parserType: 'boot'
  },
  // 新增：当前登录用户
  { 
    id: 'logged_users', 
    category: 'system', 
    name: 'Logged Users', 
    cn_name: '当前登录用户', 
    description: 'Users currently logged into the system', 
    cn_description: '当前登录到系统的用户', 
    command: "who | awk '{print $1\"|\"$2\"|\"$3\" \"$4\"|\"$5}'", 
    icon: Server,
    parserType: 'simpleList',
    parserArgs: ['th_user', 'th_terminal', 'th_time', 'th_ip_address']
  },
  // 新增：文件系统I/O统计
  { 
    id: 'disk_io', 
    category: 'system', 
    name: 'Disk I/O', 
    cn_name: '磁盘 I/O', 
    description: 'Disk input/output statistics', 
    cn_description: '磁盘输入/输出统计', 
    command: "iostat -dx | awk 'NR>1 && $1!=\"Device\" && $1!=\"\" {print $1\"|\"$2\"|\"$8\"|\"$3\"|\"$9\"|\"$NF}'", 
    icon: Database, 
    checkExists: true,
    parserType: 'diskIO'
  },
  // 新增：系统温度（如果支持）
  { 
    id: 'system_temp', 
    category: 'system', 
    name: 'System Temperature', 
    cn_name: '系统温度', 
    description: 'System temperature sensors (if available)', 
    cn_description: '系统温度传感器数据（如果可用）', 
    command: "sensors 2>/dev/null || cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | awk '{printf \"%.1f°C\n\", $1/1000}' | head -n 5 || echo 'Temperature sensors not available'", 
    icon: Activity, 
    checkExists: true 
  },
  // 新增：文件打开数
  { 
    id: 'file_handles', 
    category: 'system', 
    name: 'File Handles', 
    cn_name: '文件打开数', 
    description: 'Current and maximum file handles', 
    cn_description: '当前和最大文件打开数', 
    command: "cat /proc/sys/fs/file-nr | awk '{print \"Allocated|\"$1 \"\\nUnused|\"$2 \"\\nMax|\"$3}'", 
    icon: Activity,
    parserType: 'simpleList',
    parserArgs: ['th_type', 'th_value']
  },
  // 新增：系统限制
  { 
    id: 'system_limits', 
    category: 'system', 
    name: 'System Limits', 
    cn_name: '系统限制', 
    description: 'System resource limits', 
    cn_description: '系统资源限制', 
    command: "ulimit -a | awk -F') ' '{print $1\") |\" $2}'", 
    icon: Server,
    parserType: 'simpleList',
    parserArgs: ['th_limit', 'th_value']
  }
];
