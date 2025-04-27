//#region ../../modules/actors/NRAboutPreferencesChild.sys.mts
var NRAboutPreferencesChild = class extends JSWindowActorChild {
	handleEvent(event) {
		if (event.type === "DOMContentLoaded") Services.scriptloader.loadSubScript("chrome://noraneko-startup/content/about-preferences.js", this.contentWindow);
	}
};

//#endregion
export { NRAboutPreferencesChild };