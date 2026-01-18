import { LucideIcon } from 'lucide-react';

export type CommandCategory = 'system' | 'network' | 'web' | 'security' | 'database' | 'docker' | 'k8s';

export type ParserType = 'disk' | 'process' | 'network' | 'ports' | 'docker' | 'k8sNodes' | 'k8sPods' | 'simpleList' | 'lsOutput' | 'authLog' | 'raw';

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
