import { registerHooks, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const mocks = new URL("./ui-runtime.mjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "excalibur") return { url: mocks, shortCircuit: true };
    let candidate;
    if (specifier.startsWith("@src/")) candidate = path.join(root, "src", specifier.slice(5));
    else if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) candidate = fileURLToPath(new URL(specifier, context.parentURL));
    if (candidate) {
      if (!path.extname(candidate)) candidate += ".ts";
      if (["level.ts", "resources.ts", "sound-manager.ts", "env.ts", "player-systems/player-actions.ts", "components/base-component.ts"].some(name => candidate === path.join(root, "src", name))) return { url: mocks, shortCircuit: true };
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {
      format: "module",
      source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), {
        mode: "transform", sourceMap: true, sourceUrl: url
      }),
      shortCircuit: true
    };
    return next(url, context);
  }
});
