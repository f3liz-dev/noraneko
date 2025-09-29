// SPDX-License-Identifier: MPL-2.0

import type { Plugin } from "vite";
import * as path from "node:path";
import * as fs from "node:fs";

export interface BridgeProxyOptions {
  /**
   * The bridge directory to proxy from
   */
  bridgeDir: string;
  /**
   * The target directory where the proxied files should be output
   */
  targetDir: string;
  /**
   * Type of bridge: 'loader-features' or 'loader-modules'
   */
  bridgeType: "loader-features" | "loader-modules";
}

export function createBridgeProxyPlugin(options: BridgeProxyOptions): Plugin {
  const { bridgeDir, targetDir, bridgeType } = options;
  
  return {
    name: "bridge-proxy",
    configResolved(config) {
      // Override output directory to target directory
      if (config.build && config.build.outDir) {
        config.build.outDir = path.resolve(targetDir, "_dist");
      }
    },
    resolveId(id, importer) {
      // Handle any imports from bridge directory by redirecting to actual bridge location
      if (id.startsWith("../../bridge/loader-features/") && bridgeType === "loader-features") {
        return path.resolve(bridgeDir, id.replace("../../bridge/loader-features/", ""));
      }
      return null;
    },
    configureServer(server) {
      // In dev mode, serve files from bridge directory
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/bridge/")) {
          const bridgePath = path.join(bridgeDir, req.url.replace("/bridge/", ""));
          if (fs.existsSync(bridgePath)) {
            res.setHeader("Content-Type", "application/javascript");
            res.end(fs.readFileSync(bridgePath, "utf8"));
            return;
          }
        }
        next();
      });
    },
    generateBundle(options, bundle) {
      // Ensure the output maintains the expected file structure
      if (bridgeType === "loader-features") {
        // For loader-features, maintain content directory structure
        Object.keys(bundle).forEach((fileName) => {
          const chunk = bundle[fileName];
          if (chunk.type === "chunk") {
            // Ensure proper module format
            chunk.code = chunk.code || "";
          }
        });
      }
    }
  };
}