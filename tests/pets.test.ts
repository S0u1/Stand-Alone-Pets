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

  it("can merge multiple pet directories without duplicate ids", () => {
    const firstDir = createTempPetsDir();
    const secondDir = createTempPetsDir();
    const firstPetDir = path.join(firstDir, "ghost");
    const secondPetDir = path.join(secondDir, "ghost");
    fs.mkdirSync(firstPetDir, { recursive: true });
    fs.mkdirSync(secondPetDir, { recursive: true });
    fs.writeFileSync(path.join(firstPetDir, "spritesheet.png"), "first");
    fs.writeFileSync(path.join(secondPetDir, "spritesheet.png"), "second");
    writeManifest(firstDir, "ghost", {
      id: "ghost",
      displayName: "First Ghost",
      description: "Loaded first.",
      spritesheetPath: "spritesheet.png",
    });
    writeManifest(secondDir, "ghost", {
      id: "ghost",
      displayName: "Second Ghost",
      description: "Skipped as duplicate.",
      spritesheetPath: "spritesheet.png",
    });

    const registry = discoverPets([firstDir, secondDir]);

    expect(registry.pets.filter((pet) => pet.id === "ghost")).toHaveLength(1);
    expect(registry.pets.find((pet) => pet.id === "ghost")?.displayName).toBe(
      "First Ghost",
    );
  });
});
