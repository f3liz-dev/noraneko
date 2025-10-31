/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "../rpc-interfaces.ts";
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

@noraComponent(import.meta.hot)
export default class Sidebar extends NoraComponentBase {
  // No dependencies - sidebar-addon-panel will register callbacks
  protected rpc!: RPCDependencies<[]>;
  
  private registeredIcons: Map<string, SidebarIconRegistration> = new Map();
  private dataUpdateCallbacks: Set<(data: any) => void> = new Set();
  private selectionChangeCallbacks: Set<(panelId: string) => void> = new Set();

  init(): void {
    // Set up cleanup
    onCleanup(() => {
      this.registeredIcons.clear();
      this.dataUpdateCallbacks.clear();
      this.selectionChangeCallbacks.clear();
    });
  }

  // RPC method: Register a sidebar icon with callback
  private async registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    callback: () => void | Promise<void>;
  }): Promise<void> {
    // Register the sidebar icon with its callback
    this.registeredIcons.set(options.name, options);
    
    console.debug(`Sidebar: Registered icon ${options.name} with callback`);
  }

  // RPC method: Handle icon click events
  private async onClicked(iconName: string): Promise<void> {
    const iconRegistration = this.registeredIcons.get(iconName);
    if (iconRegistration && iconRegistration.callback) {
      try {
        await iconRegistration.callback();
        console.debug(`Sidebar: Icon ${iconName} callback executed`);
      } catch (error) {
        console.error(`Sidebar: Error executing callback for icon ${iconName}:`, error);
      }
    } else {
      console.warn(`Sidebar: No callback registered for icon ${iconName}`);
    }
  }

  // RPC method: Register callback for data updates
  private registerDataUpdateCallback(callback: (data: any) => void): void {
    this.dataUpdateCallbacks.add(callback);
    console.debug("Sidebar: Registered data update callback");
  }

  // RPC method: Register callback for selection changes
  private registerSelectionChangeCallback(callback: (panelId: string) => void): void {
    this.selectionChangeCallbacks.add(callback);
    console.debug("Sidebar: Registered selection change callback");
  }

  // RPC method: Unregister a callback
  private unregisterDataUpdateCallback(callback: (data: any) => void): void {
    this.dataUpdateCallbacks.delete(callback);
  }

  // RPC method: Unregister a callback
  private unregisterSelectionChangeCallback(callback: (panelId: string) => void): void {
    this.selectionChangeCallbacks.delete(callback);
  }

  // Public API methods that can be called by other components
  public async notifyDataChanged(data: any): Promise<void> {
    setPanelSidebarData(data);
    
    // Call all registered callbacks instead of dispatching events
    for (const callback of this.dataUpdateCallbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error("Sidebar: Error in data update callback:", error);
      }
    }
  }

  public async notifyConfigChanged(config: any): Promise<void> {
    setPanelSidebarConfig(config);
  }

  public async selectPanel(panelId: string): Promise<void> {
    setSelectedPanelId(panelId);
    
    // Call all registered callbacks instead of dispatching events
    for (const callback of this.selectionChangeCallbacks) {
      try {
        callback(panelId);
      } catch (error) {
        console.error("Sidebar: Error in selection change callback:", error);
      }
    }
  }

  public getRegisteredIcons(): SidebarIconRegistration[] {
    return Array.from(this.registeredIcons.values());
  }

  _metadata() {
    return {
      moduleName: "sidebar",
      dependencies: [],
      softDependencies: [], // No dependencies - other modules register callbacks with us
      // Expose RPC methods that other modules can call
      rpcMethods: {
        registerSidebarIcon: (options: {
          name: string;
          i18nName: string;
          iconUrl: string;
          callback: () => void | Promise<void>;
        }) => this.registerSidebarIcon(options),
        onClicked: (iconName: string) => this.onClicked(iconName),
        registerDataUpdateCallback: (callback: (data: any) => void) => this.registerDataUpdateCallback(callback),
        registerSelectionChangeCallback: (callback: (panelId: string) => void) => this.registerSelectionChangeCallback(callback),
        unregisterDataUpdateCallback: (callback: (data: any) => void) => this.unregisterDataUpdateCallback(callback),
        unregisterSelectionChangeCallback: (callback: (panelId: string) => void) => this.unregisterSelectionChangeCallback(callback),
      },
    };
  }
}

// Register this module in the global registry for automatic type inference
declare global {
  interface FeatureModuleRegistry {
    Sidebar: typeof Sidebar;
  }
}
