/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { For, createEffect } from "solid-js";
import type { SidebarIconRegistration } from "../index.ts";

/**
 * DockBar component - renders the vertical sidebar dock with icons
 * This component is independent and does not depend on other modules
 */
export function DockBar(props: {
  icons: () => SidebarIconRegistration[];
  onIconClick: (iconName: string) => void;
}) {
  return (
    <div class="sidebar-dock-bar">
      <For each={props.icons()}>
        {(icon) => (
          <DockIcon
            icon={icon}
            onClick={() => props.onIconClick(icon.name)}
          />
        )}
      </For>
    </div>
  );
}

/**
 * DockIcon component - renders a single icon in the dock bar
 */
function DockIcon(props: {
  icon: SidebarIconRegistration;
  onClick: () => void;
}) {
  return (
    <button
      class="sidebar-dock-icon"
      title={props.icon.i18nName}
      onClick={props.onClick}
      data-icon-name={props.icon.name}
    >
      <img
        src={props.icon.iconUrl}
        alt={props.icon.i18nName}
        width="16"
        height="16"
      />
    </button>
  );
}
