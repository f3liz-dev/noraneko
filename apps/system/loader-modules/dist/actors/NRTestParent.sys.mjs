import { createBirpc } from "../dist-CGZv3Mu9.mjs";

//#region ../../modules/actors/NRTestParent.sys.mts
var NRTestParent = class extends JSWindowActorParent {
	serverFunctions = { onDOMContentLoaded: function(href) {
		Services.obs.notifyObservers({
			type: "DOMContentLoaded",
			href
		}, "NRTest");
	} };
	rpc = createBirpc(this.serverFunctions, {
		post: (data) => this.sendAsyncMessage("rpc", data),
		on: (fn) => this.onRPCMessage = fn,
		serialize: (v) => JSON.stringify(v),
		deserialize: (v) => JSON.parse(v)
	});
	onRPCMessage = null;
	async receiveMessage(message) {
		if (message.name === "rpc") this.onRPCMessage?.(message.data);
	}
};

//#endregion
export { NRTestParent };