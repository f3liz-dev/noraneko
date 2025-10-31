/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "../rpc-interfaces.ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
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

@noraComponent(import.meta.hot)
export default class SidebarAddonPanel extends NoraComponentBase {
  // Type-safe RPC access - Either handles both available and missing modules
  protected rpc!: RPCDependencies<["sidebar"]>;

  private ctx: CPanelSidebar | null = null;

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

    // Register example sidebar icons (demonstrating the usage)
    this.registerExampleSidebarIcons();

    // Set up cleanup
    onCleanup(() => {
      this.ctx = null;
    });
  }

  // RPC methods that can be called by sidebar via registered callbacks
  private onPanelDataUpdate(data: any): void {
    // Handle panel data updates from sidebar core
    console.debug("SidebarAddonPanel: Received panel data update", data);
    // Update UI components with new data directly
    if (this.ctx) {
      // Update UI directly - no custom events needed
      // The actual UI update logic would go here
    }
  }

  private onPanelSelectionChange(panelId: string): void {
    // Handle panel selection changes from sidebar core
    console.debug("SidebarAddonPanel: Panel selection changed to", panelId);
    // Update UI directly - no custom events needed
    if (this.ctx) {
      // The actual UI update logic would go here
    }
  }

  // Example method that demonstrates registering sidebar icons
  private async registerExampleSidebarIcons(): Promise<void> {
    // Register notes icon with callback (not birpcMethodName)
    const notesResult = await this.rpc.sidebar.registerSidebarIcon({
      name: "notes",
      i18nName: "sidebar.notes.title",
      iconUrl: "./icons/notes.svg",
      callback: () => this.onNotesIconActivated(), // Direct callback
    });

    pipe(
      notesResult,
      E.fold(
        (error) => console.warn("Failed to register notes icon:", error),
        () => console.debug("Notes icon registered successfully"),
      ),
    );

    // Register bookmarks icon with callback
    const bookmarksResult = await this.rpc.sidebar.registerSidebarIcon({
      name: "bookmarks",
      i18nName: "sidebar.bookmarks.title",
      iconUrl: "chrome://browser/skin/bookmark.svg",
      callback: () => this.onBookmarksIconActivated(), // Direct callback
    });

    pipe(
      bookmarksResult,
      E.fold(
        (error) => console.warn("Failed to register bookmarks icon:", error),
        () => console.debug("Bookmarks icon registered successfully"),
      ),
    );

    // Register callbacks for data updates and selection changes
    const dataCallbackResult =
      await this.rpc.sidebar.registerDataUpdateCallback((data: any) =>
        this.onPanelDataUpdate(data),
      );

    const selectionCallbackResult =
      await this.rpc.sidebar.registerSelectionChangeCallback(
        (panelId: string) => this.onPanelSelectionChange(panelId),
      );

    console.debug("SidebarAddonPanel: Callbacks registered with sidebar");
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
    const result = await this.rpc.sidebar.onClicked(iconName);

    // Handle the Either result
    pipe(
      result,
      E.fold(
        (error) => console.error("Failed to handle icon click:", error),
        () => console.debug("Icon click handled successfully"),
      ),
    );
  }

  _metadata() {
    return {
      moduleName: "sidebar-addon-panel",
      dependencies: [],
      softDependencies: ["sidebar"], // sidebar is a soft dependency
      // No RPC methods needed - callbacks are registered directly with sidebar
      rpcMethods: {
        // Can keep these if other modules need to call them directly
      },
    };
  }
}

// Register this module in the global registry for automatic type inference
declare global {
  interface FeatureModuleRegistry {
    SidebarAddonPanel: typeof SidebarAddonPanel;
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
export {
  PanelSidebarElem,
  PanelSidebarElem as Sidebar,
} from "./ui/components/sidebar.tsx";

/* Re-export panel APIs */
export * from "./panel";

/* Styles (now sourced from our own styles directory) */
export { default as style } from "./ui/styles/style.css?inline";
