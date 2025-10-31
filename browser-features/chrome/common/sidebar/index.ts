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
  birpcMethodName: string;
}

@noraComponent(import.meta.hot)
export default class Sidebar extends NoraComponentBase {
  // Type-safe RPC access to dependencies
  protected rpc!: RPCDependencies<["sidebar-addon-panel"]>;
  
  private registeredIcons: Map<string, SidebarIconRegistration> = new Map();

  init(): void {
    // Set up data watchers to notify addon panel of changes
    this.setupDataWatchers();

    // Set up cleanup
    onCleanup(() => {
      // Cleanup if needed
    });
  }

  // RPC method: Register a sidebar icon
  private async registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    birpcMethodName: string;
  }): Promise<void> {
    // Register the sidebar icon and store the callback method name
    this.registeredIcons.set(options.name, options);
    
    console.debug(`Sidebar: Registered icon ${options.name} with callback ${options.birpcMethodName}`);
    
    // Dispatch custom event for UI updates (instead of Services.obs)
    const event = new CustomEvent("noraneko-sidebar-icon-activated", {
      detail: {
        iconName: options.name,
        i18nName: options.i18nName,
        iconUrl: options.iconUrl
      }
    });
    document.dispatchEvent(event);
  }

  // RPC method: Handle icon click events
  private async onClicked(iconName: string): Promise<void> {
    // Handle icon click events
    const iconRegistration = this.registeredIcons.get(iconName);
    if (iconRegistration) {
      // Trigger the registered callback method via RPC using this.rpc
      const callbackMethod = (this.rpc["sidebar-addon-panel"] as any)[iconRegistration.birpcMethodName];
      if (callbackMethod && typeof callbackMethod === "function") {
        await callbackMethod();
      }
      
      // Dispatch custom event (instead of Services.obs)
      const event = new CustomEvent("noraneko-sidebar-icon-clicked", {
        detail: {
          iconName: iconName,
          i18nName: iconRegistration.i18nName,
          iconUrl: iconRegistration.iconUrl
        }
      });
      document.dispatchEvent(event);
    }
    
    console.debug(`Sidebar: Icon ${iconName} clicked`);
  }

  private setupDataWatchers(): void {
    // Watch for data changes and notify addon panel
    // Note: In a real implementation, you would set up reactive effects
    // to watch the data signals and call these methods when they change
    
    // For now, we'll provide methods that can be called manually
    // In the real implementation, these would be triggered by solid-js effects
  }

  // Public API methods that can be called by other components
  public async notifyDataChanged(data: any): Promise<void> {
    setPanelSidebarData(data);
    await this.rpc["sidebar-addon-panel"].onPanelDataUpdate(data);
    
    // Dispatch custom event (instead of Services.obs)
    const event = new CustomEvent("noraneko-sidebar-data-changed", {
      detail: { data }
    });
    document.dispatchEvent(event);
  }

  public async notifyConfigChanged(config: any): Promise<void> {
    setPanelSidebarConfig(config);
    
    // Dispatch custom event (instead of Services.obs)
    const event = new CustomEvent("noraneko-sidebar-config-changed", {
      detail: { config }
    });
    document.dispatchEvent(event);
  }

  public async selectPanel(panelId: string): Promise<void> {
    setSelectedPanelId(panelId);
    await this.rpc["sidebar-addon-panel"].onPanelSelectionChange(panelId);
    
    // Dispatch custom event (instead of Services.obs)
    const event = new CustomEvent("noraneko-sidebar-panel-selected", {
      detail: { panelId }
    });
    document.dispatchEvent(event);
  }

  public getRegisteredIcons(): SidebarIconRegistration[] {
    return Array.from(this.registeredIcons.values());
  }

  _metadata() {
    return {
      moduleName: "sidebar",
      dependencies: [],
      softDependencies: ["sidebar-addon-panel"],
      // Expose RPC methods that other modules can call
      rpcMethods: {
        registerSidebarIcon: (options: {
          name: string;
          i18nName: string;
          iconUrl: string;
          birpcMethodName: string;
        }) => this.registerSidebarIcon(options),
        onClicked: (iconName: string) => this.onClicked(iconName),
      },
    };
  }
}
