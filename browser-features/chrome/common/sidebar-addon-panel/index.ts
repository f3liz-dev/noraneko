/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import {
  registerModuleRPC,
  getModuleProxy,
  getSoftModuleProxy,
} from "#bridge-loader-features/loader/modules-hooks.ts";
import { onCleanup } from "solid-js";
import { 
  CPanelSidebar,
  PanelSidebarElem,
  SidebarContextMenuElem,
  PanelSidebarAddModal,
  PanelSidebarFloating,
} from "./ui";
import { WebsitePanelWindowChild } from "./panel/website-panel-window-child";
import { migratePanelSidebarData } from "./data/migration.ts";

// Define communication interfaces for sidebar addon panel
interface SidebarAddonPanelRPCInterface {
  onPanelDataUpdate(data: any): void;
  onPanelSelectionChange(panelId: string): void;
  onNotesIconActivated(): void;
  onBookmarksIconActivated(): void;
}

interface SidebarRPCInterface {
  registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    birpcMethodName: string;
  }): Promise<void>;
  onClicked(iconName: string): Promise<void>;
}

@noraComponent(import.meta.hot)
export default class SidebarAddonPanel extends NoraComponentBase {
  private ctx: CPanelSidebar | null = null;
  private sidebarProxy: SidebarRPCInterface | null = null;

  init(): void {
    // Run data migration first
    migratePanelSidebarData();

    // Initialize UI components
    this.ctx = new CPanelSidebar();
    WebsitePanelWindowChild.getInstance();
    new PanelSidebarElem(this.ctx);
    new SidebarContextMenuElem(this.ctx);
    PanelSidebarAddModal.getInstance();
    PanelSidebarFloating.getInstance();

    // Set up RPC communication - get a soft proxy to sidebar module
    // Using soft proxy means we won't throw errors if sidebar module is not loaded
    this.sidebarProxy = getSoftModuleProxy<SidebarRPCInterface>("sidebar");

    // Register example sidebar icons (demonstrating the usage)
    this.registerExampleSidebarIcons();

    // Set up cleanup
    onCleanup(() => {
      this.sidebarProxy = null;
      this.ctx = null;
    });
  }

  // RPC methods that can be called by other modules
  private onPanelDataUpdate(data: any): void {
    // Handle panel data updates from sidebar core
    console.debug("SidebarAddonPanel: Received panel data update", data);
    // Update UI components with new data
    if (this.ctx) {
      // Trigger UI update via internal event system (not Services.obs)
      // Using custom event on the document
      const event = new CustomEvent("noraneko-addon-panel-internal-update", {
        detail: { type: "panel-data-update", data }
      });
      document.dispatchEvent(event);
    }
  }

  private onPanelSelectionChange(panelId: string): void {
    // Handle panel selection changes from sidebar core
    console.debug("SidebarAddonPanel: Panel selection changed to", panelId);
    const event = new CustomEvent("noraneko-addon-panel-internal-update", {
      detail: { type: "panel-selection-change", panelId }
    });
    document.dispatchEvent(event);
  }

  // Example method that demonstrates registering sidebar icons
  private async registerExampleSidebarIcons(): Promise<void> {
    if (!this.sidebarProxy) {
      console.warn("SidebarAddonPanel: Sidebar module not available, cannot register icons");
      return;
    }

    // Register a notes icon
    // Using soft proxy, this will silently fail if sidebar module is not loaded
    await this.sidebarProxy.registerSidebarIcon({
      name: "notes",
      i18nName: "sidebar.notes.title", 
      iconUrl: "./icons/notes.svg",
      birpcMethodName: "onNotesIconActivated"
    });

    // Register a bookmark icon
    await this.sidebarProxy.registerSidebarIcon({
      name: "bookmarks",
      i18nName: "sidebar.bookmarks.title",
      iconUrl: "chrome://browser/skin/bookmark.svg", 
      birpcMethodName: "onBookmarksIconActivated"
    });

    console.debug("SidebarAddonPanel: Example sidebar icons registered");
  }

  // Example callback methods that would be triggered by sidebar icon activation
  private onNotesIconActivated(): void {
    console.debug("SidebarAddonPanel: Notes icon was activated");
    // Handle notes panel activation - this would be called via RPC from sidebar module
  }

  private onBookmarksIconActivated(): void {
    console.debug("SidebarAddonPanel: Bookmarks icon was activated");
    // Handle bookmarks panel activation - this would be called via RPC from sidebar module
  }

  // Example method to demonstrate icon click handling
  public async handleIconClick(iconName: string): Promise<void> {
    console.debug(`SidebarAddonPanel: Handling click for icon: ${iconName}`);
    if (this.sidebarProxy) {
      await this.sidebarProxy.onClicked(iconName);
    }
  }

  _metadata() {
    return {
      moduleName: "sidebar-addon-panel",
      dependencies: [],
      softDependencies: ["sidebar"], // sidebar is a soft dependency
      // Expose RPC methods that other modules can call
      rpcMethods: {
        onPanelDataUpdate: (data: any) => this.onPanelDataUpdate(data),
        onPanelSelectionChange: (panelId: string) => this.onPanelSelectionChange(panelId),
        onNotesIconActivated: () => this.onNotesIconActivated(),
        onBookmarksIconActivated: () => this.onBookmarksIconActivated(),
      } as SidebarAddonPanelRPCInterface,
    };
  }
}

/* Re-export UI components for backward compatibility */
export { CPanelSidebar } from "./ui/components/panel-sidebar.tsx";
export { SidebarContextMenuElem } from "./ui/components/sidebar-contextMenu.tsx";
export { PanelSidebarAddModal } from "./ui/components/panel-sidebar-modal.tsx";
export { PanelSidebarFloating } from "./ui/components/floating.tsx";
export { BrowserBox } from "./ui/components/browser-box.tsx";
export { FloatingSplitter } from "./ui/components/floating-splitter.tsx";
export { SidebarHeader } from "./ui/components/sidebar-header.tsx";
export { PanelSidebarButton } from "./ui/components/sidebar-panel-button.tsx";
export { SidebarSelectbox } from "./ui/components/sidebar-selectbox.tsx";
export { SidebarSplitter } from "./ui/components/sidebar-splitter.tsx";
export { PanelSidebarElem, PanelSidebarElem as Sidebar } from "./ui/components/sidebar.tsx";

/* Re-export panel APIs */
export * from "./panel";

/* Styles (now sourced from our own styles directory) */
export { default as style } from "./ui/styles/style.css?inline";
