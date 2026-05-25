import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface PetManifest {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
}

export interface PetDescriptor {
  id: string;
  displayName: string;
  description: string;
  spritesheetUrl: string | null;
  isBuiltIn: boolean;
}

export interface PetRegistryResult {
  pets: PetDescriptor[];
  assetMap: Map<string, string>;
}

export const builtInPet: PetDescriptor = {
  id: "builtin-spark",
  displayName: "Spark",
  description: "A tiny built-in companion used when no local pet pack is available.",
  spritesheetUrl: null,
  isBuiltIn: true,
};

function getCodexPetsDir(): string {
  const codexHome = process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  return path.join(codexHome, "pets");
}

function getBundledPetsDir(): string {
  return path.join(__dirname, "../pets");
}

function getDefaultPetDirs(): string[] {
  return [getCodexPetsDir(), getBundledPetsDir()];
}

function isPetManifest(value: unknown): value is PetManifest {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const manifest = value as Record<string, unknown>;
  return (
    typeof manifest.id === "string" &&
    typeof manifest.displayName === "string" &&
    typeof manifest.description === "string" &&
    typeof manifest.spritesheetPath === "string"
  );
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function discoverPets(petsDirs: string | string[] = getDefaultPetDirs()): PetRegistryResult {
  const assetMap = new Map<string, string>();
  const discovered: PetDescriptor[] = [];
  const seenIds = new Set<string>();
  const dirs = Array.isArray(petsDirs) ? petsDirs : [petsDirs];

  for (const petsDir of dirs) {
    try {
      for (const entry of fs.readdirSync(petsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const folderPath = path.join(petsDir, entry.name);
        const manifestPath = path.join(folderPath, "pet.json");
        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as unknown;
        if (!isPetManifest(parsed)) {
          continue;
        }

        const spritesheetPath = path.resolve(folderPath, parsed.spritesheetPath);
        if (!isPathInside(folderPath, spritesheetPath) || !fs.existsSync(spritesheetPath)) {
          continue;
        }

        const id = parsed.id || entry.name;
        if (seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);
        assetMap.set(id, spritesheetPath);
        discovered.push({
          id,
          displayName: parsed.displayName,
          description: parsed.description,
          spritesheetUrl: `pet-asset://${encodeURIComponent(id)}`,
          isBuiltIn: false,
        });
      }
    } catch {
      continue;
    }
  }

  discovered.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { pets: [builtInPet, ...discovered], assetMap };
}
