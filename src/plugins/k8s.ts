/**
 * 插件名称: Kubernetes Plugin
 * 功能描述: K8s 集群状态检测插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (k8s)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { Cloud } from 'lucide-react';
import { PluginCommand } from './types';

export const k8sCommands: PluginCommand[] = [
  { 
    id: 'k8s_client', 
    category: 'k8s', 
    name: 'K8s Client', 
    cn_name: 'K8s 客户端', 
    description: 'Kubectl client version', 
    cn_description: 'Kubectl 客户端版本', 
    command: "if command -v kubectl >/dev/null 2>&1; then kubectl version --client; else echo 'Kubernetes Not Detected'; fi", 
    icon: Cloud, 
    checkExists: true
  },
  { 
    id: 'k8s_nodes', 
    category: 'k8s', 
    name: 'K8s Nodes', 
    cn_name: 'K8s 节点状态', 
    description: 'Status of Kubernetes cluster nodes', 
    cn_description: 'Kubernetes 集群节点状态列表', 
    // 获取节点状态并解析关键字段
    command: "if command -v kubectl >/dev/null 2>&1; then kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,ROLES:.metadata.labels.'kubernetes\\.io/role',VERSION:.status.nodeInfo.kubeletVersion --no-headers | awk '{print $1 \"|\" $2 \"|\" $3 \"|\" $4}'; else echo 'Kubernetes Not Detected'; fi", 
    icon: Cloud, 
    parserType: 'k8sNodes', 
    checkExists: true
  },
  { 
    id: 'k8s_pods', 
    category: 'k8s', 
    name: 'K8s Pods', 
    cn_name: 'K8s Pod 列表', 
    description: 'List of pods in all namespaces', 
    cn_description: '所有命名空间下的 Pod 列表', 
    command: "if command -v kubectl >/dev/null 2>&1; then kubectl get pods --all-namespaces --no-headers | head -n 20 | awk '{print $1 \"|\" $2 \"|\" $4 \"|\" $5}'; else echo 'Kubernetes Not Detected'; fi", 
    icon: Cloud, 
    parserType: 'k8sPods', 
    checkExists: true
  }
];
