import { th } from "./th";
// Add a complete en.ts dictionary after Thai copy approval; change activeLocale here.
export const activeLocale = "th" as const;
export const copy = th;
export type CopyDictionary = { [Key in keyof typeof th]: string };
