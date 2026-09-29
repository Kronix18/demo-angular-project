// Minimal typings for the style-guard spec (no @types/node in this project).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
}
