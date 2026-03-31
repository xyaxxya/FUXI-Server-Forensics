import { LucideIcon } from 'lucide-react';

export type CommandCategory = 'system' | 'network' | 'web' | 'security' | 'database' | 'docker' | 'k8s' | 'response';

export type ParserType =
  | 'disk'
  | 'process'
  | 'network'
  | 'ports'
  | 'docker'
  | 'k8sNodes'
  | 'k8sPods'
  | 'simpleList'
  | 'lsOutput'
  | 'authLog'
  | 'raw'
  | 'memory'
  | 'boot'
  | 'diskIO'
  | 'uptimeHuman'
  | 'linuxRelease'
  | 'rebootHistory'
  | 'timeSync'
  | 'processStats'
  | 'netTraffic'
  | 'temperature'
  | 'sudoPerm'
  | 'firewallStatus'
  | 'cronJobs'
  | 'ssConnections'
  | 'routeSnapshot'
  | 'neighborSnapshot'
  | 'firewallRules'
  | 'dnsConfig'
  | 'btAuth'
  | 'btUser'
  | 'nginxInfo'
  | 'nginxConfig'
  | 'tlsCert'
  | 'webAccessLog'
  | 'packageList'
  | 'serviceStatus'
  | 'dbSlowLog'
  | 'dbPermissionMatrix'
  | 'dockerInfo'
  | 'dockerPrivileged'
  | 'k8sEvents'
  | 'k8sRbac';

export interface PluginCommand {
  id: string;
  category: CommandCategory;
  name: string;
  cn_name: string;
  description: string;
  cn_description: string;
  command: string;
  icon?: LucideIcon;
  checkExists?: boolean;
  prerequisite?: string;
  parserType?: ParserType;
  fallbackParser?: (output: string) => string;
  parserArgs?: any;
}
