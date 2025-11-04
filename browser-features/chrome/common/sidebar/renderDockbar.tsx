import { DockBar } from "./ui/dock-bar";
import dockBarStyle from "./ui/dock-bar.css?inline";
import { render } from "@nora/solid-xul";

export function _renderDockbar(parentElem, beforeElem, getIcons, onClicked) {
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
    document.head,
  );
}
