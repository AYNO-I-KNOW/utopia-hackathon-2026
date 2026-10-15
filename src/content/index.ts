import { th } from "./th";
// Add a complete en.ts dictionary after Thai copy approval; change activeLocale here.
export const activeLocale = "th" as const;
export const copy = th;
type Widen<T> = T extends string ? string : { [Key in keyof T]: Widen<T[Key]> };
export type CopyDictionary = Widen<typeof th>;
