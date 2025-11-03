// SPDX-License-Identifier: MPL-2.0

import { initI18NForBrowserChrome } from "#i18n/config-browser-chrome.ts";

import { MODULES, MODULES_KEYS } from "./modules.ts";
import {
  onModuleLoaded,
  _registerModuleLoadState,
  _rejectOtherLoadStates,
} from "./modules-hooks.ts";
import { registerModuleRPC } from "./rpc-registry.ts";

console.log("[noraneko] Initializing scripts...");

export const loader = {
  load: initScripts,
};

export async function initScripts() {
  // Import required modules and initialize i18n
  ChromeUtils.importESModule("resource://noraneko/modules/BrowserGlue.sys.mjs");
  const { NoranekoConstants } = ChromeUtils.importESModule(
    "resource://noraneko/modules/NoranekoConstants.sys.mjs",
  );
  initI18NForBrowserChrome();
  console.debug(
    `[noraneko-buildid2]\nuuid: ${NoranekoConstants.buildID2}\ndate: ${new Date(
      Number.parseInt(
        NoranekoConstants.buildID2.slice(0, 13).replace("-", ""),
        16,
      ),
    ).toISOString()}`,
  );

  setPrefFeatures(MODULES_KEYS);

  // Get enabled features from preferences
  const enabled_features = JSON.parse(
    Services.prefs.getStringPref("noraneko.features.enabled", "{}"),
  ) as typeof MODULES_KEYS;

  // Load enabled modules
  const modules = await loadEnabledModules(enabled_features);

  // Initialize modules after session is ready
  await initializeModules(modules);
}

async function setPrefFeatures(all_features_keys: typeof MODULES_KEYS) {
  // Set up preferences for features
  const prefs = Services.prefs.getDefaultBranch(null as unknown as string);
  prefs.setStringPref(
    "noraneko.features.all",
    JSON.stringify(all_features_keys),
  );
  Services.prefs.lockPref("noraneko.features.all");

  prefs.setStringPref(
    "noraneko.features.enabled",
    JSON.stringify(all_features_keys),
  );
}

interface ModuleMetadata {
  moduleName: string;
  dependencies: string[];
  softDependencies: string[];
  rpcMethods?: Record<string, (...args: any[]) => any>;
}

interface LoadedModule {
  name: string;
  metadata: ModuleMetadata;
  init?: typeof Function;
  initBeforeSessionStoreInit?: typeof Function;
  default?: typeof Function;
  rpcMethods?: Record<string, (...args: any[]) => any>;
}

async function loadEnabledModules(enabled_features: typeof MODULES_KEYS): Promise<LoadedModule[]> {
  const modules: LoadedModule[] = [];

  const loadModulePromises = Object.entries(MODULES).flatMap(
    ([categoryKey, categoryValue]) =>
      Object.keys(categoryValue).map(async (moduleName) => {
        if (
          categoryKey in enabled_features &&
          enabled_features[
            categoryKey as keyof typeof enabled_features
          ].includes(moduleName)
        ) {
          try {
            const moduleExports = await categoryValue[moduleName]();
            const metadata = (moduleExports as any).default?._metadata?.() || {moduleName,dependencies:[],softDependencies:[]} satisfies ModuleMetadata;
            const module: LoadedModule = {
              name: moduleName,
              metadata,
              ...(moduleExports as {
                init?: typeof Function;
                initBeforeSessionStoreInit?: typeof Function;
                default?: typeof Function;
              }),
            };
            console.log(module);
            modules.push(module);
          } catch (e) {
            console.error(`[noraneko] Failed to load module ${moduleName}:`, e);
          }
        }
      }),
  );

  await Promise.all(loadModulePromises);
  return modules;
}

async function initializeModules(modules: LoadedModule[]) {
  // Validate dependencies
  validateDependencies(modules);

  // Sort modules by dependencies
  const sortedModules = sortModulesByDependencies(modules);

  // Register RPC methods for all modules first (before initialization)
  for (const module of sortedModules) {
    if (module.metadata.rpcMethods) {
      try {
        registerModuleRPC(module.name, module.metadata.rpcMethods);
        console.debug(`[noraneko] Registered RPC methods for module ${module.metadata.moduleName}`);
      } catch (e) {
        console.error(`[noraneko] Failed to register RPC methods for module ${module.metadata.moduleName}:`, e);
      }
    }
  }

  for (const module of sortedModules) {
    try {
      await module?.initBeforeSessionStoreInit?.();
    } catch (e) {
      console.error(
        `[noraneko] Failed to initBeforeSessionStoreInit module ${module.name}:`,
        e,
      );
    }
  }
  // @ts-expect-error SessionStore type not defined
  await SessionStore.promiseInitialized;

  for (const module of sortedModules) {
    try {
      // Wait for hard dependencies to load
      // Note: Due to topological sorting, dependencies come before dependents,
      // so this typically resolves immediately unless a dependency is still initializing
      for (const dep of module.metadata.dependencies) {
        await onModuleLoaded(dep);
      }

      if (module?.init) {
        await module.init();
      }
      if (module?.default) {
        new module.default();
      }
      _registerModuleLoadState(module.name, true);
    } catch (e) {
      console.error(`[noraneko] Failed to init module ${module.name}:`, e);
      _registerModuleLoadState(module.name, false);
    }
  }
  _registerModuleLoadState("__init_all__", true);
  await _rejectOtherLoadStates();
}

function validateDependencies(modules: LoadedModule[]): void {
  const moduleNames = new Set(modules.map(m => m.name));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const moduleMap = new Map(modules.map(m => [m.name, m]));

  const checkCircular = (name: string, deps: string[], path: string[] = []): void => {
    if (visiting.has(name)) {
      const cycle = [...path, name].join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    if (visited.has(name)) return;

    visiting.add(name);
    const newPath = [...path, name];
    for (const dep of deps) {
      const depModule = moduleMap.get(dep);
      if (depModule) {
        checkCircular(dep, depModule.metadata.dependencies, newPath);
      }
    }
    visiting.delete(name);
    visited.add(name);
  };

  for (const module of modules) {
    // Check hard dependencies exist
    for (const dep of module.metadata.dependencies) {
      if (!moduleNames.has(dep)) {
        throw new Error(`Missing dependency: ${dep} required by ${module.name}`);
      }
    }

    // Check for circular dependencies
    checkCircular(module.name, module.metadata.dependencies);
  }
}

function sortModulesByDependencies(modules: LoadedModule[]): LoadedModule[] {
  const sorted: LoadedModule[] = [];
  const processed = new Set<string>();
  const moduleMap = new Map(modules.map(m => [m.name, m]));

  const process = (module: LoadedModule): void => {
    if (processed.has(module.name)) return;

    // Process dependencies first
    for (const depName of module.metadata.dependencies) {
      const depModule = moduleMap.get(depName);
      if (depModule && !processed.has(depName)) {
        process(depModule);
      }
    }

    sorted.push(module);
    processed.add(module.name);
  };

  for (const module of modules) {
    process(module);
  }

  return sorted;
}
