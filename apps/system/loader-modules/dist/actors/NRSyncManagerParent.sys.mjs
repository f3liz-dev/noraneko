//#region ../../modules/actors/NRSyncManagerParent.sys.mts
var NRSyncManagerParent = class extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "SyncManager:GetAccountInfo": {
				const { UIState } = ChromeUtils.importESModule("resource://services-sync/UIState.sys.mjs");
				this.sendAsyncMessage("SyncManager:GetAccountInfo", JSON.stringify(UIState.get()));
			}
		}
	}
};

//#endregion
export { NRSyncManagerParent };