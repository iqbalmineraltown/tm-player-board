/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ResourceId = 'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat';

export interface ResourceState {
  inventory: number;
  production: number;
}

export interface GameState {
  generation: number;
  terraformRating: number;
  resources: Record<ResourceId, ResourceState>;
  oxygen: number; // 0 to 14
  temperature: number; // -30 to +8
  oceans: number; // 0 to 9
  milestones: {
    terraformer: boolean;
    mayor: boolean;
    gardener: boolean;
    builder: boolean;
    planner: boolean;
  };
}

export interface LogEntry {
  id: string;
  generation: number;
  timestamp: string;
  message: string;
  type: 'system' | 'adjust' | 'production' | 'parameter' | 'milestone' | 'reset';
}

export type ActiveTab = 'command' | 'prod_sys' | 'milestones' | 'sys_log' | 'manual';
