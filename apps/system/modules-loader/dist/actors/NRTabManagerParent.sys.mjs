//#region ../../modules/actors/NRTabManagerParent.sys.mts
var NRTabManagerParent = class extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "Tabs:AddTab": {
				const { url, options } = message.data;
				const win = Services.wm.getMostRecentWindow("navigator:browser");
				win.gBrowser.selectedTab = win.gBrowser.addTab(url, {
					relatedToCurrent: true,
					triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
					...options
				});
				this.sendAsyncMessage("Tabs:AddTab");
			}
		}
	}
};

//#endregion
export { NRTabManagerParent };