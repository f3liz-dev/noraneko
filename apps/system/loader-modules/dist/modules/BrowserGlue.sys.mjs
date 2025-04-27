import { ActorManagerParent } from "resource://gre/modules/ActorManagerParent.sys.mjs";

//#region ../../modules/modules/BrowserGlue.sys.mts
function localPathToResourceURI(path) {
	const re = new RegExp(/\.\.\/([a-zA-Z0-9-_\/]+)\.sys\.mts/);
	const result = re.exec(path);
	if (!result || result.length != 2) throw Error(`[nora-browserGlue] localPathToResource URI match failed : ${path}`);
	const resourceURI = `resource://noraneko/${result[1]}.sys.mjs`;
	return resourceURI;
}
const JS_WINDOW_ACTORS = {
	NRAboutNewTab: {
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRAboutNewTabChild.sys.mts"),
			events: { DOMContentLoaded: {} }
		},
		matches: [
			"about:home*",
			"about:welcome",
			"about:newtab*"
		],
		remoteTypes: ["privilegedabout"]
	},
	NRAboutPreferences: {
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRAboutPreferencesChild.sys.mts"),
			events: { DOMContentLoaded: {} }
		},
		matches: ["about:preferences*", "about:settings*"]
	},
	NRSettings: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRSettingsParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRSettingsChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*", "chrome://noraneko-settings/*"]
	},
	NRTabManager: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRTabManagerParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRTabManagerChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*", "chrome://noraneko-settings/*"]
	},
	NRSyncManager: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRSyncManagerParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRSyncManagerChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*", "chrome://noraneko-settings/*"]
	},
	NRAppConstants: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRAppConstantsParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRAppConstantsChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*"]
	},
	NRRestartBrowser: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRRestartBrowserParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRRestartBrowserChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*", "chrome://noraneko-settings/*"]
	},
	NRProgressiveWebApp: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRProgressiveWebAppParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRProgressiveWebAppChild.sys.mts"),
			events: { pageshow: {} }
		},
		allFrames: true
	},
	NRPwaManager: {
		parent: { esModuleURI: localPathToResourceURI("../actors/NRPwaManagerParent.sys.mts") },
		child: {
			esModuleURI: localPathToResourceURI("../actors/NRPwaManagerChild.sys.mts"),
			events: { DOMDocElementInserted: {} }
		},
		matches: ["*://localhost/*", "chrome://noraneko-settings/*"]
	}
};
ActorManagerParent.addJSWindowActors(JS_WINDOW_ACTORS);

//#endregion