// SPDX-License-Identifier: MPL-2.0

import { assert, assertEquals, assertRejects } from "@jsr/std__assert";
import {
  rpcRegistry,
  registerModuleRPC,
  unregisterModuleRPC,
  callModuleRPC,
  tryCallModuleRPC,
  getModuleProxy,
  getSoftModuleProxy,
  isModuleRegistered,
} from "#bridge-loader-features/loader/rpc-registry.ts";

// Test module A with RPC methods
const moduleAFunctions = {
  getData: () => "test-data",
  setData: (value: string) => {
    console.log("setData called with:", value);
    return value;
  },
  asyncMethod: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return "async-result";
  },
  throwError: () => {
    throw new Error("Intentional error");
  },
};

// Test module B with RPC methods
const moduleBFunctions = {
  ping: () => "pong",
  add: (a: number, b: number) => a + b,
};

// Test 1: Module registration
Deno.test("RPC Registry - Register and check module", () => {
  registerModuleRPC("test-module-a", moduleAFunctions);
  assert(isModuleRegistered("test-module-a"), "Module should be registered");
  unregisterModuleRPC("test-module-a");
  assert(!isModuleRegistered("test-module-a"), "Module should be unregistered");
});

// Test 2: Call RPC method
Deno.test("RPC Registry - Call RPC method", async () => {
  registerModuleRPC("test-module-a", moduleAFunctions);
  const result = await callModuleRPC<string>("test-module-a", "getData");
  assertEquals(result, "test-data", "Should return correct data");
  unregisterModuleRPC("test-module-a");
});

// Test 3: Call RPC method with arguments
Deno.test("RPC Registry - Call RPC method with arguments", async () => {
  registerModuleRPC("test-module-b", moduleBFunctions);
  const result = await callModuleRPC<number>("test-module-b", "add", 5, 3);
  assertEquals(result, 8, "Should return sum of arguments");
  unregisterModuleRPC("test-module-b");
});

// Test 4: Call async RPC method
Deno.test("RPC Registry - Call async RPC method", async () => {
  registerModuleRPC("test-module-a", moduleAFunctions);
  const result = await callModuleRPC<string>("test-module-a", "asyncMethod");
  assertEquals(result, "async-result", "Should return async result");
  unregisterModuleRPC("test-module-a");
});

// Test 5: Call non-existent module
Deno.test(
  "RPC Registry - Call non-existent module should timeout",
  async () => {
    await assertRejects(
      async () => {
        await callModuleRPC("non-existent-module", "someMethod");
      },
      Error,
      "Timeout",
      "Should throw timeout error",
    );
  },
);

// Test 6: Try call non-existent module (soft call)
Deno.test(
  "RPC Registry - Try call non-existent module should return undefined",
  async () => {
    const result = await tryCallModuleRPC("non-existent-module", "someMethod");
    assertEquals(
      result,
      undefined,
      "Should return undefined for missing module",
    );
  },
);

// Test 7: Try call existing module
Deno.test("RPC Registry - Try call existing module", async () => {
  registerModuleRPC("test-module-a", moduleAFunctions);
  const result = await tryCallModuleRPC<string>("test-module-a", "getData");
  assertEquals(result, "test-data", "Should return data");
  unregisterModuleRPC("test-module-a");
});

// Test 8: Get proxy and call methods
Deno.test("RPC Registry - Use proxy to call methods", async () => {
  registerModuleRPC("test-module-b", moduleBFunctions);

  interface ModuleBInterface {
    ping(): Promise<string>;
    add(a: number, b: number): Promise<number>;
  }

  const proxy = getModuleProxy<ModuleBInterface>("test-module-b");
  const pingResult = await proxy.ping();
  const addResult = await proxy.add(10, 20);

  assertEquals(pingResult, "pong", "Proxy should call ping method");
  assertEquals(addResult, 30, "Proxy should call add method");

  unregisterModuleRPC("test-module-b");
});

// Test 9: Get soft proxy (doesn't throw)
Deno.test("RPC Registry - Use soft proxy (doesn't throw)", async () => {
  interface ModuleInterface {
    getData(): Promise<string>;
  }

  const proxy = getSoftModuleProxy<ModuleInterface>("non-existent-module");
  const result = await proxy.getData();

  assertEquals(
    result,
    undefined,
    "Soft proxy should return undefined for missing module",
  );
});

// Test 10: Handle errors in RPC methods
Deno.test("RPC Registry - Handle errors in RPC methods", async () => {
  registerModuleRPC("test-module-a", moduleAFunctions);

  await assertRejects(
    async () => {
      await callModuleRPC("test-module-a", "throwError");
    },
    Error,
    "Intentional error",
    "Should propagate error from RPC method",
  );

  unregisterModuleRPC("test-module-a");
});

// Test 11: Soft call handles errors gracefully
Deno.test("RPC Registry - Soft call handles errors gracefully", async () => {
  registerModuleRPC("test-module-a", moduleAFunctions);

  const result = await tryCallModuleRPC("test-module-a", "throwError");
  assertEquals(result, undefined, "Soft call should return undefined on error");

  unregisterModuleRPC("test-module-a");
});

// Test 12: Multiple modules can be registered
Deno.test("RPC Registry - Multiple modules", async () => {
  registerModuleRPC("module-1", { method1: () => "result1" });
  registerModuleRPC("module-2", { method2: () => "result2" });

  const result1 = await callModuleRPC<string>("module-1", "method1");
  const result2 = await callModuleRPC<string>("module-2", "method2");

  assertEquals(result1, "result1");
  assertEquals(result2, "result2");

  unregisterModuleRPC("module-1");
  unregisterModuleRPC("module-2");
});

// Test 13: Pending calls are processed when module is registered
Deno.test("RPC Registry - Pending calls are processed", async () => {
  // Start a call before the module is registered
  const callPromise = callModuleRPC<string>("delayed-module", "getData");

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Now register the module
  registerModuleRPC("delayed-module", { getData: () => "delayed-data" });

  // The pending call should now resolve
  const result = await callPromise;
  assertEquals(
    result,
    "delayed-data",
    "Pending call should resolve after module registration",
  );

  unregisterModuleRPC("delayed-module");
});

console.log("All RPC Registry tests passed!");
