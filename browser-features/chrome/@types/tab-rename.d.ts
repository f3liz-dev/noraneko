// SPDX-License-Identifier: MPL-2.0

declare global {
  interface Window {
    gNoraShowTabRenameInput?: (tab: XULElement) => void;
  }
}

export {};
