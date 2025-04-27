import { createBirpc } from "../dist-CGZv3Mu9.mjs";

//#region ../../modules/actors/NRTestChild.sys.mts
var NRTestChild = class extends JSWindowActorChild {
	clientFunctions = {};
	rpc = createBirpc(this.clientFunctions, {
		post: (data) => this.sendAsyncMessage("rpc", data),
		on: (fn) => this.onRPCMessage = fn,
		serialize: (v) => JSON.stringify(v),
		deserialize: (v) => JSON.parse(v)
	});
	onRPCMessage = null;
	async receiveMessage(message) {
		if (message.name === "rpc") this.onRPCMessage?.(message.data);
	}
	handleEvent(event) {
		if (event.type === "DOMContentLoaded") this.rpc.onDOMContentLoaded(this.contentWindow?.location.href);
	}
};

//#endregion
export { NRTestChild };