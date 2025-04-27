//#region ../../modules/actors/NRAboutNewTabChild.sys.mts
var NRAboutNewTabChild = class extends JSWindowActorChild {
	handleEvent(event) {
		if (event.type === "DOMContentLoaded") Services.scriptloader.loadSubScript("chrome://noraneko-startup/content/about-newtab.js", this.contentWindow);
	}
};

//#endregion
export { NRAboutNewTabChild };