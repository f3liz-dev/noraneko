// SPDX-License-Identifier: MPL-2.0

import { defineConfig, defaultClientConditions, defaultServerConditions } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  environments: {
    client: {
      resolve: {
        // Pre-configure conditions to avoid dynamic import issue in vite-plugin-solid
        conditions: defaultClientConditions,
      },
    },
    ssr: {
      resolve: {
        // Pre-configure conditions to avoid dynamic import issue in vite-plugin-solid
        conditions: defaultServerConditions,
      },
    },
  },
  plugins: [
    solidPlugin({
      solid: {
        generate: "dom",
        hydratable: false,
      },
    }),
  ],
});
