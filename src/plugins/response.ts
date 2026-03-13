import { Activity, Globe, Cpu, HardDrive } from 'lucide-react';
import { PluginCommand } from './types';

export const responseCommands: PluginCommand[] = [
  {
    id: 'response_net_rate',
    category: 'response',
    name: 'Realtime Network Rate',
    cn_name: '实时网络速率',
    description: 'Aggregated RX/TX byte rate source from all non-loopback interfaces',
    cn_description: '聚合所有非回环网卡的 RX/TX 字节统计源',
    command: "awk 'NR>2 && $1 !~ /lo:/ {rx+=$2; tx+=$10} END {printf \"RX:%d TX:%d\\n\", rx, tx}' /proc/net/dev",
    icon: Globe
  },
  {
    id: 'response_conn_count',
    category: 'response',
    name: 'Established Connections',
    cn_name: '已建立连接数',
    description: 'Current established TCP/UDP connection count',
    cn_description: '当前已建立的 TCP/UDP 连接数量',
    command: "ss -tun state established 2>/dev/null | awk 'NR>1 {count++} END {printf \"CONN:%d\\n\", count+0}'",
    icon: Activity
  },
  {
    id: 'response_host_cpu',
    category: 'response',
    name: 'Host CPU Usage',
    cn_name: '主机 CPU 占用',
    description: 'Current host CPU usage percentage',
    cn_description: '当前主机 CPU 使用率',
    command: "top -bn1 | awk -F'[, ]+' '/Cpu\\(s\\)/{for(i=1;i<=NF;i++) if($i ~ /id/) idle=$(i-1)} END{if(idle==\"\") idle=0; printf \"CPU:%.2f\\n\", 100-idle}'",
    icon: Cpu
  },
  {
    id: 'response_host_mem',
    category: 'response',
    name: 'Host Memory Usage',
    cn_name: '主机内存占用',
    description: 'Current host memory usage percentage',
    cn_description: '当前主机内存使用率',
    command: "free | awk '/Mem:/ {printf \"MEM:%.2f\\n\", ($3/$2)*100}'",
    icon: HardDrive
  },
  {
    id: 'response_top_flows',
    category: 'response',
    name: 'Top Active Flows',
    cn_name: '活跃连接流向',
    description: 'Active outbound and inbound flows with remote IP, port and process',
    cn_description: '活跃外联/入站连接，含远端 IP、端口与进程信息',
    command: "ss -tunp state established 2>/dev/null | awk 'NR>1 {split($4,l,\":\"); split($5,r,\":\"); if(r[1]!=\"\" && r[1]!=\"127.0.0.1\" && r[1]!=\"::1\") print l[1]\"|\"l[2]\"|\"r[1]\"|\"r[2]\"|\"$1\"|\"$6}' | head -n 60",
    icon: Globe
  },
  {
    id: 'response_listen_services',
    category: 'response',
    name: 'Listening Services',
    cn_name: '监听服务',
    description: 'Listening ports and bound process names',
    cn_description: '监听端口及绑定进程',
    command: "ss -lntup 2>/dev/null | awk 'NR>1 {split($5,a,\":\"); print $1\"|\"a[length(a)]\"|\"$7}' | head -n 60",
    icon: Activity
  },
  {
    id: 'response_top_proc_cpu',
    category: 'response',
    name: 'Top CPU Processes',
    cn_name: 'CPU 高占用进程',
    description: 'Top processes sorted by CPU usage',
    cn_description: '按 CPU 占用排序的高风险进程',
    command: "ps -eo pid,comm,%cpu,%mem --sort=-%cpu | awk 'NR>1 && NR<=21 {print $1\"|\"$2\"|\"$3\"|\"$4}'",
    icon: Cpu
  },
  {
    id: 'response_top_proc_mem',
    category: 'response',
    name: 'Top Memory Processes',
    cn_name: '内存高占用进程',
    description: 'Top processes sorted by memory usage',
    cn_description: '按内存占用排序的高风险进程',
    command: "ps -eo pid,comm,%cpu,%mem --sort=-%mem | awk 'NR>1 && NR<=21 {print $1\"|\"$2\"|\"$3\"|\"$4}'",
    icon: HardDrive
  }
];
