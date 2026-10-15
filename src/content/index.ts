import { en } from "./en";
import { th } from "./th";
export const activeLocale = "en" as const;
const dictionaries = { th, en } as const;
export const copy = dictionaries[activeLocale];
/** Every locale file must provide exactly these keys. */
export type CopyDictionary = typeof en;
