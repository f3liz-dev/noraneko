//#region ../../modules/actors/NRTabManagerChild.sys.mts
var NRTabManagerChild = class extends JSWindowActorChild {
	actorCreated() {
		console.debug("NRTabManagerChild created!");
		const window = this.contentWindow;
		if (window?.location.port === "5183") {
			console.debug("NRTabManager 5183!");
			Cu.exportFunction(this.NRAddTab.bind(this), window, { defineAs: "NRAddTab" });
		}
	}
	NRAddTab(url, options = {}, callback = () => {}) {
		const promise = new Promise((resolve, _reject) => {
			this.resolveAddTab = resolve;
		});
		this.sendAsyncMessage("Tabs:AddTab", {
			url,
			options
		});
		promise.then((_v) => callback());
	}
	resolveAddTab = null;
	resolveLoadTrustedUrl = null;
	async receiveMessage(message) {
		switch (message.name) {
			case "Tabs:AddTab": {
				this.resolveAddTab?.();
				this.resolveLoadTrustedUrl = null;
				break;
			}
		}
	}
};

//#endregion
export { NRTabManagerChild };