//#region ../../modules/actors/NRPwaManagerChild.sys.mts
var NRPwaManagerChild = class extends JSWindowActorChild {
	actorCreated() {
		console.debug("NRPwaManagerChild created!");
		const window = this.contentWindow;
		if (window?.location.port === "5183") {
			console.debug("NRPwaManager 5183!");
			Cu.exportFunction(this.NRGetInstalledApps.bind(this), window, { defineAs: "NRGetInstalledApps" });
			Cu.exportFunction(this.NRRenameSsb.bind(this), window, {
				defineAs: "NRRenameSsb",
				asAsync: true
			});
			Cu.exportFunction(this.NRUninstallSsb.bind(this), window, {
				defineAs: "NRUninstallSsb",
				asAsync: true
			});
		}
	}
	NRGetInstalledApps(callback = () => {}) {
		const promise = new Promise((resolve, _reject) => {
			this.resolveGetInstalledApps = resolve;
		});
		this.sendAsyncMessage("PwaManager:GetInstalledApps");
		promise.then((installedApps) => callback(installedApps));
	}
	NRRenameSsb(id, newName) {
		this.sendAsyncMessage("PwaManager:RenameSsb", {
			id,
			newName
		});
	}
	NRUninstallSsb(id) {
		this.sendAsyncMessage("PwaManager:UninstallSsb", { id });
	}
	resolveGetInstalledApps = null;
	resolveRenameSsb = null;
	resolveUninstallSsb = null;
	async receiveMessage(message) {
		switch (message.name) {
			case "PwaManager:GetInstalledApps": {
				this.resolveGetInstalledApps?.(message.data);
				this.resolveGetInstalledApps = null;
				break;
			}
			case "PwaManager:RenameSsb": {
				this.resolveRenameSsb?.(message.data.wrappedJSObject.id, message.data.wrappedJSObject.newName);
				this.resolveRenameSsb = null;
				break;
			}
			case "PwaManager:UninstallSsb": {
				this.resolveUninstallSsb?.(message.data.wrappedJSObject.id);
				this.resolveUninstallSsb = null;
				break;
			}
		}
	}
};

//#endregion
export { NRPwaManagerChild };