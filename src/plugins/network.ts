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
    command: "ss -lntup 2>/dev/null | awk 'NR>1 {print $1 \"|\" $5 \"|\" $7}'",
    icon: Server, 
    parserType: 'ports' 
  },
  { 
    id: 'all_connections', 
    category: 'network', 
    name: 'All Connections', 
    cn_name: '全连接快照', 
    description: 'All TCP/UDP connections with processes', 
    cn_description: '所有 TCP/UDP 连接及对应进程快照', 
    command: "ss -tunap 2>/dev/null", 
    icon: Server,
    parserType: 'ssConnections'
  },
  { 
    id: 'route_snapshot', 
    category: 'network', 
    name: 'Route Snapshot', 
    cn_name: '路由快照', 
    description: 'Kernel routing table snapshot', 
    cn_description: '内核路由表快照', 
    command: "ip route show table all", 
    icon: Server,
    parserType: 'routeSnapshot'
  },
  { 
    id: 'neighbor_snapshot', 
    category: 'network', 
    name: 'Neighbor Snapshot', 
    cn_name: '邻居表快照', 
    description: 'ARP/NDP neighbor cache snapshot', 
    cn_description: 'ARP/NDP 邻居缓存快照', 
    command: "ip neigh show", 
    icon: Server,
    parserType: 'neighborSnapshot'
  },
  { 
    id: 'firewall_rules_snapshot', 
    category: 'network', 
    name: 'Firewall Rules Snapshot', 
    cn_name: '防火墙规则快照', 
    description: 'iptables/nftables/ufw rules snapshot', 
    cn_description: 'iptables/nftables/ufw 规则快照', 
    command: "iptables -S 2>/dev/null || nft list ruleset 2>/dev/null || ufw status verbose 2>/dev/null || echo 'No firewall rules detected'", 
    icon: Server,
    parserType: 'firewallRules'
  },
  { 
    id: 'dns_config', 
    category: 'network', 
    name: 'DNS Configuration', 
    cn_name: 'DNS 配置', 
    description: 'DNS nameserver configuration', 
    cn_description: '系统的 DNS 域名服务器配置', 
    command: "cat /etc/resolv.conf | grep nameserver", 
    icon: Server,
    parserType: 'dnsConfig'
  }
];
