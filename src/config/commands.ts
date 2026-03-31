import { forensicsCommands } from '../plugins/forensics';
import { PluginCommand } from '../plugins/types';

export const commands: PluginCommand[] = [
  ...forensicsCommands
];

export type { PluginCommand };
