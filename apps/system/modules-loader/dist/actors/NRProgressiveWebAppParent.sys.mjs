//#region ../../modules/actors/NRProgressiveWebAppParent.sys.mts
var NRProgressiveWebAppParent = class extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "ProgressiveWebApp:CheckPageHasManifest": return this.sendNotifyToPageAction();
		}
		return null;
	}
	sendNotifyToPageAction() {
		Services.obs.notifyObservers({}, "nora-pwa-check-page-has-manifest");
	}
};

//#endregion
export { NRProgressiveWebAppParent };