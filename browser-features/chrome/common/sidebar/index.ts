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
import { render } from "@nora/solid-xul";
import {
  panelSidebarData,
  setPanelSidebarData,
  panelSidebarConfig,
  setPanelSidebarConfig,
  selectedPanelId,
  setSelectedPanelId,
} from "./core/data.ts";
import { DockBar } from "./ui/dock-bar.tsx";
import dockBarStyle from "./ui/dock-bar.css?inline";

export interface SidebarIconRegistration {
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
  registerSidebarIcon(options: SidebarIconRegistration): Promise<void>;
  onClicked(iconName: string): Promise<void>;
  registerDataUpdateCallback(callback: (data: any) => void): Promise<void>;
  registerSelectionChangeCallback(callback: (panelId: string) => void): Promise<void>;
  unregisterDataUpdateCallback(callback: (data: any) => void): Promise<void>;
  unregisterSelectionChangeCallback(callback: (panelId: string) => void): Promise<void>;
  getRegisteredIcons(): Promise<SidebarIconRegistration[]>;
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
    // Inject styles only once
    if (!document?.getElementById("sidebar-dock-bar-styles")) {
      render(
        () => <style id="sidebar-dock-bar-styles">{dockBarStyle}</style>,
        document?.head
      );
    }

    // Render dock bar component
    const parentElem = document?.getElementById("browser");
    const beforeElem = document?.getElementById("panel-sidebar-box") || 
                       document?.getElementById("tabbrowser-tabbox");

    if (parentElem && beforeElem) {
      render(
        () => (
          <DockBar
            icons={this.getIcons}
            onIconClick={(iconName) => this.onClicked(iconName)}
          />
        ),
        parentElem,
        { marker: beforeElem as XULElement }
      );
    } else {
      this.logger.warn("Could not find parent or marker element for dock bar");
    }
  }

  // Public RPC methods for registration (exposed to other modules)
  @rpcMethod
  async registerSidebarIcon(options: SidebarIconRegistration): Promise<void> {
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
        this.logger.error(`Error executing callback for icon ${iconName}:`, error);
      }
    } else {
      this.logger.warn(`No callback registered for icon ${iconName}`);
    }
  }

  @rpcMethod
  async registerDataUpdateCallback(callback: (data: any) => void): Promise<void> {
    this.dataUpdateCallbacks.add(callback);
    this.logger.debug("Registered data update callback");
  }

  @rpcMethod
  async registerSelectionChangeCallback(callback: (panelId: string) => void): Promise<void> {
    this.selectionChangeCallbacks.add(callback);
    this.logger.debug("Registered selection change callback");
  }

  @rpcMethod
  async unregisterDataUpdateCallback(callback: (data: any) => void): Promise<void> {
    this.dataUpdateCallbacks.delete(callback);
  }

  @rpcMethod
  async unregisterSelectionChangeCallback(callback: (panelId: string) => void): Promise<void> {
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
  @rpcMethod
  async getRegisteredIcons(): Promise<SidebarIconRegistration[]> {
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
