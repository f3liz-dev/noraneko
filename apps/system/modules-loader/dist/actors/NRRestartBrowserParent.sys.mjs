//#region ../../modules/actors/NRRestartBrowserParent.sys.mts
var NRRestartBrowserParent = class extends JSWindowActorParent {
	async receiveMessage(message) {
		switch (message.name) {
			case "RestartBrowser:Restart": {
				let result = false;
				try {
					Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
					result = true;
				} catch (error) {
					console.error("Failed to restart browser:", error);
				}
				this.sendAsyncMessage("RestartBrowser:Result", result);
			}
		}
	}
};

//#endregion
export { NRRestartBrowserParent };