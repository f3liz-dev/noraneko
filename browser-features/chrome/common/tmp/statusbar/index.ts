// SPDX-License-Identifier: MPL-2.0

import { render } from "@nora/solid-xul";
import { ContextMenu } from "./context-menu";
import { StatusBarElem } from "./statusbar";
import { StatusBarManager } from "./statusbar-manager";
import { component } from "#features-chrome/utils/base";

export let manager: StatusBarManager;

@component({
  moduleName: "statusbar",
  dependencies: [],
  softDependencies: [],
  hot: import.meta.hot,
})
export default class StatusBar {
  init() {
    manager = new StatusBarManager();
    render(StatusBarElem, document.body, {
      marker: document?.getElementById("customization-container"),
    });
    //https://searchfox.org/mozilla-central/rev/4d851945737082fcfb12e9e7b08156f09237aa70/browser/base/content/main-popupset.js#321
    const mainPopupSet = document.getElementById("mainPopupSet");
    mainPopupSet?.addEventListener("popupshowing", onPopupShowing);

    manager.init();
  }
  static _metadata() {
    return {
      moduleName: "statusbar",
      dependencies: [],
      softDependencies: [],
      eventMethods: {},
    } as const;
  }
}

function onPopupShowing(event: Event) {
  switch (event.target.id) {
    case "toolbar-context-menu":
      render(
        ContextMenu,
        document.getElementById("viewToolbarsMenuSeparator")!.parentElement,
        {
          marker: document.getElementById("viewToolbarsMenuSeparator")!,
          hotCtx: import.meta.hot,
        },
      );
  }

  _metadata = () => {
    return {
      moduleName: "statusbar",
      dependencies: [],
      softDependencies: [],
    };
  };
}
