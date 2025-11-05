/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Sidebar Module
 *
 * This module provides an independent dock bar that can be used to register icons.
 * It exposes a registration API via RPC that other modules can use.
 *
 * Key Features:
 * - Renders a vertical dock bar with icons
 * - Provides RPC methods for icon registration
 * - Manages icon click callbacks
 * - Does not depend on other feature modules
 *
 * Architecture:
 * - This module is independent and can be used by any other module
 * - Other modules (like sidebar-addon-panel) use RPC to register icons
 * - When icons are clicked, registered callbacks are invoked
 */

import { component, rpcMethod } from "#features-chrome/utils/base.ts";
import { createSignal, onCleanup } from "solid-js";

import {
  panelSidebarConfig,
  panelSidebarData,
  selectedPanelId,
  setPanelSidebarConfig,
  setPanelSidebarData,
  setSelectedPanelId,
} from "./core/data.ts";

import { _renderDockbar, _renderStyle } from "./renderDockbar.tsx";

export interface SidebarIconRegistration {
  name: string;
  i18nName: string;
  iconUrl: string;
  callback: () => void | Promise<void>;
}

// 1. Define RPC interface
export interface SidebarRPC {
  notifyDataChanged(data: any): void;
  notifyConfigChanged(config: any): void;
  selectPanel(panelId: string): void;
  registerSidebarIcon(options: SidebarIconRegistration): void;
  onClicked(iconName: string): Promise<void>;
  registerDataUpdateCallback(callback: (data: any) => void): void;
  registerSelectionChangeCallback(
    callback: (panelId: string) => void,
  ): void;
  unregisterDataUpdateCallback(callback: (data: any) => void): void;
  unregisterSelectionChangeCallback(
    callback: (panelId: string) => void,
  ): void;
  getRegisteredIcons(): SidebarIconRegistration[];
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
  private getIcons!: () => SidebarIconRegistration[];
  private setIcons!: (icons: SidebarIconRegistration[]) => void;

  init(): void {
    console.log("init sidebar!");
    console.log(this.rpcMethods());
    // Create signal for icons
    const [getIcons, setIcons] = createSignal<SidebarIconRegistration[]>([]);
    this.getIcons = getIcons;
    this.setIcons = setIcons;

    // Render the dock bar UI
    this.renderDockBar();

    onCleanup(() => {
      this.registeredIcons.clear();
      this.dataUpdateCallbacks.clear();
      this.selectionChangeCallbacks.clear();
    });
  }

  private renderDockBar(): void {
    // Validate document is available
    if (!document) {
      this.logger.error("Document is not available, cannot render dock bar");
      return;
    }

    // Inject styles only once
    if (!document.getElementById("sidebar-dock-bar-styles")) {
      _renderStyle();
    }

    // Render dock bar component
    const parentElem = document.getElementById("browser");
    const beforeElem = document.getElementById("panel-sidebar-box") ||
      document.getElementById("tabbrowser-tabbox");

    if (parentElem && beforeElem) {
      _renderDockbar(
        parentElem,
        beforeElem,
        this.getIcons,
        this.onClicked.bind(this),
      );
    } else {
      this.logger.error(
        "Could not find parent or marker element for dock bar. " +
          `parentElem: ${!!parentElem}, beforeElem: ${!!beforeElem}`,
      );
    }
  }

  // Public RPC methods for registration (exposed to other modules)
  @rpcMethod
  registerSidebarIcon(options: SidebarIconRegistration): void {
    this.registeredIcons.set(options.name, options);
    // Update the signal to trigger UI update
    this.setIcons(Array.from(this.registeredIcons.values()));
    this.logger.debug(`Registered icon ${options.name} with callback`);
  }

  @rpcMethod
  async onClicked(iconName: string): Promise<void> {
    const iconRegistration = this.registeredIcons.get(iconName);
    if (iconRegistration?.callback) {
      try {
        await iconRegistration.callback();
        this.logger.debug(`Icon ${iconName} callback executed`);
      } catch (error) {
        this.logger.error(
          `Error executing callback for icon ${iconName}:`,
          error,
        );
      }
    } else {
      this.logger.warn(`No callback registered for icon ${iconName}`);
    }
  }

  @rpcMethod
  registerDataUpdateCallback(
    callback: (data: any) => void,
  ): void {
    this.dataUpdateCallbacks.add(callback);
    this.logger.debug("Registered data update callback");
  }

  @rpcMethod
  registerSelectionChangeCallback(
    callback: (panelId: string) => void,
  ): void {
    this.selectionChangeCallbacks.add(callback);
    this.logger.debug("Registered selection change callback");
  }

  @rpcMethod
  unregisterDataUpdateCallback(
    callback: (data: any) => void,
  ): void {
    this.dataUpdateCallbacks.delete(callback);
  }

  @rpcMethod
  unregisterSelectionChangeCallback(
    callback: (panelId: string) => void,
  ): void {
    this.selectionChangeCallbacks.delete(callback);
  }

  // Public RPC methods (exposed to other modules)
  @rpcMethod
  notifyDataChanged(data: any): void {
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
  notifyConfigChanged(config: any): void {
    setPanelSidebarConfig(config);
  }

  @rpcMethod
  selectPanel(panelId: string): void {
    setSelectedPanelId(panelId);

    for (const callback of this.selectionChangeCallbacks) {
      try {
        callback(panelId);
      } catch (error) {
        this.logger.error("Error in selection change callback:", error);
      }
    }
  }

  // Public RPC method to get registered icons
  @rpcMethod
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
