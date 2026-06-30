import assert from "node:assert/strict";
import path from "node:path";

import { getTargetDir, normalizeConfig } from "../server/index.js";

const config = normalizeConfig({
  vaultPath: "/Users/ray/Documents/My Vault",
  saveFolder: "网页收藏/"
});

assert.deepEqual(config, {
  vaultPath: "/Users/ray/Documents/My Vault",
  saveFolder: "网页收藏"
});
assert.equal(
  getTargetDir(config),
  path.join("/Users/ray/Documents/My Vault", "网页收藏")
);

assert.throws(
  () => normalizeConfig({ vaultPath: "Documents/Vault", saveFolder: "网页收藏" }),
  /vaultPath 必须是绝对路径/
);
assert.throws(
  () => normalizeConfig({ vaultPath: "/Users/ray/Documents/Vault", saveFolder: "../其他目录" }),
  /saveFolder 只能是 Vault 内的相对目录/
);
assert.throws(
  () => normalizeConfig({ vaultPath: "/Users/ray/Documents/Vault", saveFolder: "/tmp" }),
  /saveFolder 只能是 Vault 内的相对目录/
);

console.log("config validation tests passed");
