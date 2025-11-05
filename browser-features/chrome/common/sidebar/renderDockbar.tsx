import { DockBar } from "./ui/dock-bar.tsx";
import dockBarStyle from "./ui/dock-bar.css?inline";
import { render } from "@nora/solid-xul";
import type { SidebarIconRegistration } from "./index.ts";

export function _renderDockbar(
  parentElem: Element,
  beforeElem: XULElement,
  getIcons: () => SidebarIconRegistration[],
  onClicked: (iconName: string) => void,
) {
  return render(
    () => (
      <DockBar
        icons={getIcons}
        onIconClick={(iconName) => onClicked(iconName)}
      />
    ),
    parentElem,
    { marker: beforeElem as XULElement },
  );
}

export function _renderStyle() {
  return render(
    () => <style id="sidebar-dock-bar-styles">{dockBarStyle}</style>,
    document?.head,
  );
}
