//#region ../../modules/actors/NRProgressiveWebAppChild.sys.mts
/**

* Loads an icon URL into a data URI.

*

* @param {Window} window the DOM window providing the icon.

* @param {string} uri the href for the icon, may be relative to the source page.

* @returns {Promise<string>} the data URI.

*/
async function loadIcon(window, uri) {
	if (!window) return null;
	const iconURL = new window.URL(uri, window.location);
	const request = new window.Request(iconURL, { mode: "cors" });
	request.overrideContentPolicyType(Ci.nsIContentPolicy.TYPE_IMAGE);
	const response = await window.fetch(request);
	const blob = await response.blob();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
var NRProgressiveWebAppChild = class extends JSWindowActorChild {
	async handleEvent(event) {
		switch (event.type) {
			case "pageshow":
				this.sendAsyncMessage("ProgressiveWebApp:CheckPageHasManifest");
				return;
		}
	}
	receiveMessage(message) {
		switch (message.name) {
			case "LoadIcon": return loadIcon(this.contentWindow, message.data);
		}
		return null;
	}
};

//#endregion
export { NRProgressiveWebAppChild };