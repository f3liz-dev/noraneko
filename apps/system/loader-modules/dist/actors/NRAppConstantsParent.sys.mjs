//#region ../../modules/actors/NRAppConstantsParent.sys.mts
var NRAppConstantsParent = class extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "AppConstants:GetConstants": {
				const { AppConstants } = ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");
				this.sendAsyncMessage("AppConstants:GetConstants", JSON.stringify(AppConstants));
			}
		}
	}
};

//#endregion
export { NRAppConstantsParent };