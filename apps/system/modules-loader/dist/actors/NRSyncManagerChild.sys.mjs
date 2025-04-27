//#region ../../modules/actors/NRSyncManagerChild.sys.mts
var NRSyncManagerChild = class extends JSWindowActorChild {
	actorCreated() {
		console.debug("NRSyncManagerChild created!");
		const window = this.contentWindow;
		if (window?.location.port === "5183") {
			console.debug("NRSyncManager 5183!");
			Cu.exportFunction(this.NRGetAccountInfo.bind(this), window, { defineAs: "NRGetAccountInfo" });
		}
	}
	NRGetAccountInfo(callback = () => {}) {
		const promise = new Promise((resolve, _reject) => {
			this.resolveGetAccountInfo = resolve;
		});
		this.sendAsyncMessage("SyncManager:GetAccountInfo");
		promise.then((accountInfo) => callback(accountInfo));
	}
	resolveGetAccountInfo = null;
	async receiveMessage(message) {
		switch (message.name) {
			case "SyncManager:GetAccountInfo": {
				this.resolveGetAccountInfo?.(message.data);
				this.resolveGetAccountInfo = null;
				break;
			}
		}
	}
};

//#endregion
export { NRSyncManagerChild };