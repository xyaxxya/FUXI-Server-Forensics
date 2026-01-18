import { systemCommands } from '../plugins/system';
import { networkCommands } from '../plugins/network';
import { webCommands } from '../plugins/web';
import { securityCommands } from '../plugins/security';
import { databaseCommands } from '../plugins/database';
import { dockerCommands } from '../plugins/docker';
import { k8sCommands } from '../plugins/k8s';
import { PluginCommand } from '../plugins/types';

export const commands: PluginCommand[] = [
  ...systemCommands,
  ...networkCommands,
  ...webCommands,
  ...securityCommands,
  ...databaseCommands,
  ...dockerCommands,
  ...k8sCommands
];

export type { PluginCommand };
