// SPDX-License-Identifier: MPL-2.0

import { defineConfig, defaultClientConditions, defaultServerConditions } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  environments: {
    client: {
      resolve: {
        conditions: defaultClientConditions,
      },
    },
    ssr: {
      resolve: {
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
