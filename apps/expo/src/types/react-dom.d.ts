// Minimal react-dom type declarations for test files.
// We cannot install @types/react-dom because it pulls in the full DOM lib
// which conflicts with the RN-only tsconfig (lib: ["ES2022"], no "dom").

declare module "react-dom/server" {
  export function renderToStaticMarkup(element: React.ReactElement): string;
  export function renderToString(element: React.ReactElement): string;
}

declare module "react-dom/client" {
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: unknown): Root;
}
