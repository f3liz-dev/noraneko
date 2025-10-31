// SPDX-License-Identifier: MPL-2.0

/**
 * Central registry for all module RPC interfaces
 * This file contains TypeScript interfaces for all module RPC methods
 * Used for type-safe RPC calls via this.rpc
 */

/**
 * Sidebar module RPC interface
 */
export interface SidebarRPC {
  registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    birpcMethodName: string;
  }): Promise<void>;
  onClicked(iconName: string): Promise<void>;
}

/**
 * Sidebar Addon Panel module RPC interface
 */
export interface SidebarAddonPanelRPC {
  onPanelDataUpdate(data: any): void;
  onPanelSelectionChange(panelId: string): void;
  onNotesIconActivated(): void;
  onBookmarksIconActivated(): void;
}

/**
 * Type mapping from module names to their RPC interfaces
 * Add new modules here to enable type-safe RPC calls
 */
export interface ModuleRPCInterfaces {
  "sidebar": SidebarRPC;
  "sidebar-addon-panel": SidebarAddonPanelRPC;
  // Add more modules here as they are migrated to RPC
}

/**
 * Helper type to create typed RPC object based on dependencies
 * Usage: RPCDependencies<["sidebar", "other-module"]>
 */
export type RPCDependencies<T extends ReadonlyArray<keyof ModuleRPCInterfaces>> = {
  [K in T[number]]: ModuleRPCInterfaces[K];
};
