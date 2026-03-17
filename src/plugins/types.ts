import { LucideIcon } from 'lucide-react';

export type CommandCategory = 'system' | 'network' | 'web' | 'security' | 'database' | 'docker' | 'k8s' | 'response';

export type ParserType = 'disk' | 'process' | 'network' | 'ports' | 'docker' | 'k8sNodes' | 'k8sPods' | 'simpleList' | 'lsOutput' | 'authLog' | 'raw' | 'memory' | 'boot' | 'diskIO' | 'uptimeHuman' | 'linuxRelease' | 'rebootHistory' | 'timeSync' | 'processStats' | 'netTraffic' | 'temperature' | 'sudoPerm' | 'firewallStatus' | 'cronJobs' | 'ssConnections' | 'routeSnapshot' | 'neighborSnapshot' | 'firewallRules' | 'dnsConfig' | 'btAuth' | 'btUser' | 'nginxInfo' | 'nginxConfig' | 'tlsCert' | 'webAccessLog' | 'packageList' | 'serviceStatus' | 'dbSlowLog' | 'dbPermissionMatrix' | 'dockerInfo' | 'dockerPrivileged' | 'k8sEvents' | 'k8sRbac';

export interface PluginCommand {
  id: string;
  category: CommandCategory;
  name: string; // English Name
  cn_name: string; // Chinese Name
  description: string; // English Description
  cn_description: string; // Chinese Description
  command: string;
  icon?: LucideIcon;
  checkExists?: boolean;
  prerequisite?: string; // Shell command to check if service exists (e.g. "command -v mysql")
  parserType?: ParserType;
  fallbackParser?: (output: string) => string;
  parserArgs?: any;
}
