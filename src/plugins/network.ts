/**
 * 插件名称: Network Plugin
 * 功能描述: 网络接口与端口检测插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (network)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 */

import { Server } from 'lucide-react';
import { PluginCommand } from './types';

export const networkCommands: PluginCommand[] = [
  { 
    id: 'net_if', 
    category: 'network', 
    name: 'Network Interfaces', 
    cn_name: '网卡 IP', 
    description: 'List of network interfaces and their IP addresses', 
    cn_description: '列出网络接口及其绑定的 IP 地址', 
    command: "ip -o -4 addr list | awk '{print $2 \"|\" $4}'", 
    icon: Server, 
    parserType: 'network' 
  },
  { 
    id: 'listen_ports', 
    category: 'network', 
    name: 'Listening Ports', 
    cn_name: '监听端口', 
    description: 'Currently listening TCP/UDP ports and associated processes', 
    cn_description: '当前正在监听的 TCP/UDP 端口及对应进程', 
    // 使用 ss 命令获取监听端口信息
    command: "ss -tulpn | awk 'NR>1 {print $1 \"|\" $5 \"|\" $7}' | head -n 10", 
    icon: Server, 
    parserType: 'ports' 
  },
  { 
    id: 'network_traffic', 
    category: 'network', 
    name: 'Network Traffic', 
    cn_name: '实时网络流量', 
    description: 'Real-time RX/TX network traffic', 
    cn_description: '实时网络接收(RX)与发送(TX)流量监控', 
    // 获取主要网卡（排除 lo）的流量统计
    command: "grep -v 'lo' /proc/net/dev | awk 'NR>2 {print $1, $2, $10}' | head -n 1", 
    icon: Server 
  },
  { 
    id: 'dns_config', 
    category: 'network', 
    name: 'DNS Configuration', 
    cn_name: 'DNS 配置', 
    description: 'DNS nameserver configuration', 
    cn_description: '系统的 DNS 域名服务器配置', 
    command: "cat /etc/resolv.conf | grep nameserver", 
    icon: Server 
  }
];
