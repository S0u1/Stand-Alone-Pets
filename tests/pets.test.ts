import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverPets } from "../electron/pets";

const tempDirs: string[] = [];

function createTempPetsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stand-alone-pets-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeManifest(
  petsDir: string,
  folderName: string,
  manifest: Record<string, string>,
): void {
  const folder = path.join(petsDir, folderName);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "pet.json"), JSON.stringify(manifest));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("pet discovery", () => {
  it("loads valid pet spritesheets inside the pet folder", () => {
    const petsDir = createTempPetsDir();
    const petDir = path.join(petsDir, "sparkle");
    fs.mkdirSync(petDir, { recursive: true });
    fs.writeFileSync(path.join(petDir, "spritesheet.png"), "png");
    writeManifest(petsDir, "sparkle", {
      id: "sparkle",
      displayName: "Sparkle",
      description: "A local test pet.",
      spritesheetPath: "spritesheet.png",
    });

    const registry = discoverPets(petsDir);

    expect(registry.pets.some((pet) => pet.id === "sparkle")).toBe(true);
    expect(registry.assetMap.get("sparkle")).toBe(path.join(petDir, "spritesheet.png"));
  });

  it("rejects spritesheet paths that escape to sibling folders", () => {
    const petsDir = createTempPetsDir();
    const siblingDir = path.join(petsDir, "cat-evil");
    fs.mkdirSync(siblingDir, { recursive: true });
    fs.writeFileSync(path.join(siblingDir, "spritesheet.png"), "png");
    writeManifest(petsDir, "cat", {
      id: "cat",
      displayName: "Cat",
      description: "Attempts to escape the pet folder.",
      spritesheetPath: "../cat-evil/spritesheet.png",
    });

    const registry = discoverPets(petsDir);

    expect(registry.pets.some((pet) => pet.id === "cat")).toBe(false);
    expect(registry.assetMap.has("cat")).toBe(false);
  });
});
