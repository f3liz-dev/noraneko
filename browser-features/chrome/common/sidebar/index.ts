/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { component, rpcMethod } from "#features-chrome/utils/base.ts";
import { onCleanup } from "solid-js";
import {
  panelSidebarData,
  setPanelSidebarData,
  panelSidebarConfig,
  setPanelSidebarConfig,
  selectedPanelId,
  setSelectedPanelId,
} from "./core/data.ts";

interface SidebarIconRegistration {
  name: string;
  i18nName: string;
  iconUrl: string;
  callback: () => void | Promise<void>;
}

// 1. Define RPC interface
export interface SidebarRPC {
  notifyDataChanged(data: any): Promise<void>;
  notifyConfigChanged(config: any): Promise<void>;
  selectPanel(panelId: string): Promise<void>;
}

// 2. Implement with decorator
@component({
  moduleName: "sidebar",
  hot: import.meta.hot,
})
export default class Sidebar implements SidebarRPC {
  protected logger!: ConsoleInstance;
  protected rpc!: any;

  private registeredIcons: Map<string, SidebarIconRegistration> = new Map();
  private dataUpdateCallbacks: Set<(data: any) => void> = new Set();
  private selectionChangeCallbacks: Set<(panelId: string) => void> = new Set();

  init(): void {
    onCleanup(() => {
      this.registeredIcons.clear();
      this.dataUpdateCallbacks.clear();
      this.selectionChangeCallbacks.clear();
    });
  }

  // Private helper methods (not exposed via RPC)
  private async registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    callback: () => void | Promise<void>;
  }): Promise<void> {
    this.registeredIcons.set(options.name, options);
    this.logger.debug(`Registered icon ${options.name} with callback`);
  }

  private async onClicked(iconName: string): Promise<void> {
    const iconRegistration = this.registeredIcons.get(iconName);
    if (iconRegistration?.callback) {
      try {
        await iconRegistration.callback();
        this.logger.debug(`Icon ${iconName} callback executed`);
      } catch (error) {
        this.logger.error(`Error executing callback for icon ${iconName}:`, error);
      }
    } else {
      this.logger.warn(`No callback registered for icon ${iconName}`);
    }
  }

  private registerDataUpdateCallback(callback: (data: any) => void): void {
    this.dataUpdateCallbacks.add(callback);
    this.logger.debug("Registered data update callback");
  }

  private registerSelectionChangeCallback(callback: (panelId: string) => void): void {
    this.selectionChangeCallbacks.add(callback);
    this.logger.debug("Registered selection change callback");
  }

  private unregisterDataUpdateCallback(callback: (data: any) => void): void {
    this.dataUpdateCallbacks.delete(callback);
  }

  private unregisterSelectionChangeCallback(callback: (panelId: string) => void): void {
    this.selectionChangeCallbacks.delete(callback);
  }

  // Public RPC methods (exposed to other modules)
  @rpcMethod
  async notifyDataChanged(data: any): Promise<void> {
    setPanelSidebarData(data);

    for (const callback of this.dataUpdateCallbacks) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error("Error in data update callback:", error);
      }
    }
  }

  @rpcMethod
  async notifyConfigChanged(config: any): Promise<void> {
    setPanelSidebarConfig(config);
  }

  @rpcMethod
  async selectPanel(panelId: string): Promise<void> {
    setSelectedPanelId(panelId);

    for (const callback of this.selectionChangeCallbacks) {
      try {
        callback(panelId);
      } catch (error) {
        this.logger.error("Error in selection change callback:", error);
      }
    }
  }

  // Public non-RPC methods (can be called directly but not via RPC)
  getRegisteredIcons(): SidebarIconRegistration[] {
    return Array.from(this.registeredIcons.values());
  }
}

// 3. Register globally
declare global {
  interface FeatureModuleRegistry {
    Sidebar: typeof Sidebar;
  }
  interface FeatureModuleRPCMethods {
    sidebar: SidebarRPC;
  }
}
