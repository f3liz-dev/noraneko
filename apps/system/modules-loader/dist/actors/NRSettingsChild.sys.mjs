import { createBirpc } from "../dist-CGZv3Mu9.mjs";

//#region ../../modules/actors/NRSettingsChild.sys.mts
var NRSettingsChild = class extends JSWindowActorChild {
	rpc;
	constructor() {
		super();
	}
	actorCreated() {
		console.debug("NRSettingsChild created!");
		const window = this.contentWindow;
		if (window?.location.port === "5183") {
			console.debug("NRSettingsChild 5183!");
			Cu.exportFunction(this.NRSPing.bind(this), window, { defineAs: "NRSPing" });
			Cu.exportFunction(this.NRSettingsSend.bind(this), window, { defineAs: "NRSettingsSend" });
			Cu.exportFunction(this.NRSettingsRegisterReceiveCallback.bind(this), window, { defineAs: "NRSettingsRegisterReceiveCallback" });
		}
	}
	NRSPing() {
		return true;
	}
	sendToPage = null;
	NRSettingsSend(data) {
		if (this.sendToPage) this.sendToPage(data);
	}
	NRSettingsRegisterReceiveCallback(callback) {
		this.rpc = createBirpc({
			getBoolPref: (prefName) => {
				return this.NRSPrefGet({
					prefName,
					"prefType": "boolean"
				});
			},
			getIntPref: (prefName) => {
				return this.NRSPrefGet({
					prefName,
					"prefType": "number"
				});
			},
			getStringPref: (prefName) => {
				return this.NRSPrefGet({
					prefName,
					"prefType": "string"
				});
			},
			setBoolPref: (prefName, prefValue) => {
				return this.NRSPrefSet({
					prefName,
					prefValue,
					prefType: "boolean"
				});
			},
			setIntPref: (prefName, prefValue) => {
				return this.NRSPrefSet({
					prefName,
					prefValue,
					prefType: "number"
				});
			},
			setStringPref: (prefName, prefValue) => {
				return this.NRSPrefSet({
					prefName,
					prefValue,
					prefType: "string"
				});
			}
		}, {
			post: (data) => callback(data),
			on: (callback$1) => {
				this.sendToPage = callback$1;
			},
			serialize: (v) => JSON.stringify(v),
			deserialize: (v) => JSON.parse(v)
		});
	}
	async NRSPrefGet(params) {
		try {
			let funcName;
			switch (params.prefType) {
				case "boolean":
					funcName = "getBoolPref";
					break;
				case "number":
					funcName = "getIntPref";
					break;
				case "string":
					funcName = "getStringPref";
					break;
				default: throw new Error("Invalid pref type");
			}
			return await this.sendQuery(funcName, { name: params.prefName });
		} catch (error) {
			console.error("Error in NRSPrefGet:", error);
			return null;
		}
	}
	async NRSPrefSet(params) {
		try {
			let funcName;
			switch (params.prefType) {
				case "boolean":
					funcName = "setBoolPref";
					break;
				case "number":
					funcName = "setIntPref";
					break;
				case "string":
					funcName = "setStringPref";
					break;
				default: throw new Error("Invalid pref type");
			}
			return await this.sendQuery(funcName, {
				name: params.prefName,
				prefValue: params.prefValue
			});
		} catch (error) {
			console.error("Error in NRSPrefSet:", error);
			return null;
		}
	}
};

//#endregion
export { NRSettingsChild };