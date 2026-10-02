import { harfbuzzEngine } from "./harfbuzz";
import { harfrustEngine, allsortsEngine } from "./rust";
import { fontkitEngine } from "./fontkit";
import {
  coretextEngine,
  directwriteEngine,
  uniscribeEngine,
} from "./native";
import type { ShapingEngine } from "./types";

export const ENGINES: ShapingEngine[] = [
  harfbuzzEngine,
  harfrustEngine,
  allsortsEngine,
  fontkitEngine,
  coretextEngine,
  directwriteEngine,
  uniscribeEngine,
];

export function getEngine(id: string): ShapingEngine {
  return ENGINES.find((e) => e.id === id) ?? harfbuzzEngine;
}

export * from "./types";
