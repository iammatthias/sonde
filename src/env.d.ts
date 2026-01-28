/// <reference path="../.astro/types.d.ts" />

// Font imports
declare module "*.woff2" {
  const content: ArrayBuffer;
  export default content;
}

declare module "*.ttf" {
  const content: ArrayBuffer;
  export default content;
}

// WASM imports
declare module "*.wasm" {
  const content: WebAssembly.Module;
  export default content;
}

declare module "@takumi-rs/wasm/takumi_wasm_bg.wasm" {
  const content: WebAssembly.Module;
  export default content;
}
