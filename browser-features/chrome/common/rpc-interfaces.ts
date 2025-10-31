// SPDX-License-Identifier: MPL-2.0

/**
 * Central registry for all module RPC interfaces
 * This file contains TypeScript interfaces for all module RPC methods
 * Used for type-safe RPC calls via this.rpc
 * 
 * NOTE: With the new Either-based system, all RPC methods automatically return
 * Promise<Either<Error, T>> for error-safe handling
 */

import type * as E from "fp-ts/Either";

/**
 * Sidebar module RPC interface
 * All methods automatically wrapped with Either for error safety
 */
export interface SidebarRPC {
  registerSidebarIcon(options: {
    name: string;
    i18nName: string;
    iconUrl: string;
    birpcMethodName: string;
  }): Promise<E.Either<Error, void>>;
  onClicked(iconName: string): Promise<E.Either<Error, void>>;
}

/**
 * Sidebar Addon Panel module RPC interface
 * All methods automatically wrapped with Either for error safety
 */
export interface SidebarAddonPanelRPC {
  onPanelDataUpdate(data: any): Promise<E.Either<Error, void>>;
  onPanelSelectionChange(panelId: string): Promise<E.Either<Error, void>>;
  onNotesIconActivated(): Promise<E.Either<Error, void>>;
  onBookmarksIconActivated(): Promise<E.Either<Error, void>>;
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
 * 
 * All methods return Either<Error, T> for error-safe handling:
 * - Hard dependencies: Either<Error, T>
 * - Soft dependencies: Either<Error, T | undefined>
 */
export type RPCDependencies<T extends ReadonlyArray<keyof ModuleRPCInterfaces>> = {
  [K in T[number]]: ModuleRPCInterfaces[K];
};
