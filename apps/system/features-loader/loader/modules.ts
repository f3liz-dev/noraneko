export const MODULES = {
  common: {} as Record<string, () => Promise<unknown>>,
  static: {} as Record<string, () => Promise<unknown>>,
};

{
  const MODULES_COMMON = import.meta.glob(
    "#chrome-features/common/*/index.ts",
  );

  Object.entries(MODULES_COMMON).map((v) => {
    MODULES
      .common[v[0].replaceAll(/\.\/common\/([a-zA-Z-]+)\/index\.ts/g, "$1")] =
        v[1] as () => Promise<unknown>;
  });
}

{
  MODULES.static = {
    downloadbar: () => import("#chrome-features/static/downloadbar/index.ts"),
    overrides: () => import("#chrome-features/static/overrides/index.ts"),
    prefs: () => import("#chrome-features/static/prefs/index.ts"),
  };
}

export const MODULES_KEYS = {
  common: Object.keys(MODULES.common),
  static: Object.keys(MODULES.static),
};
