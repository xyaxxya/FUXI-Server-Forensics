/**
 * 插件名称: Docker Plugin
 * 功能描述: Docker 容器与镜像管理插件
 * 
 * 参数说明:
 * - id: 唯一标识符
 * - category: 归属分类 (docker)
 * - name: 英文显示名称
 * - cn_name: 中文显示名称
 * - description: 英文描述
 * - cn_description: 中文描述
 * - command: 执行的 Shell 命令
 * - icon: 图标组件
 * - parserType: (可选) 解析器类型
 * - checkExists: (可选) 是否检查命令是否存在
 */

import { Box } from 'lucide-react';
import { PluginCommand } from './types';

export const dockerCommands: PluginCommand[] = [
  { 
    id: 'docker_ver', 
    category: 'docker', 
    name: 'Docker Version', 
    cn_name: 'Docker 版本', 
    description: 'Docker engine version', 
    cn_description: 'Docker 引擎版本信息', 
    command: "if command -v docker >/dev/null 2>&1; then docker --version; else echo 'Docker Not Detected'; fi", 
    icon: Box, 
    checkExists: true
  },
  { 
    id: 'docker_compose', 
    category: 'docker', 
    name: 'Docker Compose', 
    cn_name: 'Docker Compose', 
    description: 'Docker Compose version', 
    cn_description: 'Docker Compose 工具版本', 
    command: "if docker compose version >/dev/null 2>&1; then docker compose version; else echo 'Docker Compose Not Detected'; fi", 
    icon: Box, 
    checkExists: true
  },
  { 
    id: 'docker_info', 
    category: 'docker', 
    name: 'Docker System Info', 
    cn_name: 'Docker 系统信息', 
    description: 'System-wide Docker information', 
    cn_description: 'Docker 系统级详细信息', 
    command: "if command -v docker >/dev/null 2>&1; then docker info; else echo 'Docker Not Detected'; fi", 
    icon: Box, 
    checkExists: true
  },
  { 
    id: 'docker_containers', 
    category: 'docker', 
    name: 'Docker Containers', 
    cn_name: '运行容器列表', 
    description: 'Running Docker containers', 
    cn_description: '当前正在运行的 Docker 容器', 
    // 使用自定义格式化输出获取容器信息
    command: "if command -v docker >/dev/null 2>&1; then docker ps --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}'; else echo 'Docker Not Detected'; fi", 
    icon: Box, 
    parserType: 'docker', 
    checkExists: true
  },
  { 
    id: 'docker_images', 
    category: 'docker', 
    name: 'Docker Images', 
    cn_name: 'Docker 镜像', 
    description: 'Top Docker images by size', 
    cn_description: '占用空间最大的 Docker 镜像', 
    // 获取占用空间最大的前10个镜像
    command: "if command -v docker >/dev/null 2>&1; then docker images --format '{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedSince}}' | head -n 10 | awk -F'|' '{print $1 \"|\" $2 \"|\" $3 \"|\" $4}'; else echo 'Docker Not Detected'; fi", 
    icon: Box, 
    parserType: 'simpleList', 
    parserArgs: ['Repo', 'Tag', 'Size', 'Created'], 
    checkExists: true
  }
];
