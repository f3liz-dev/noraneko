import { loader } from "#bridge-loader-features/loader/index.ts";

export default async function initScripts() {
  await loader.load();
}
