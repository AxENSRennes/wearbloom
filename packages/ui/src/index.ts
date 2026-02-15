import { twMerge } from "tailwind-merge";

export const cn = (...inputs: string[]) => twMerge(...inputs);

export { Button } from "./button";
export { wearbloomTheme } from "./gluestack-config";
export type { WearbloomTheme } from "./gluestack-config";
