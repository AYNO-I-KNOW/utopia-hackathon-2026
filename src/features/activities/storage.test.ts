import { test } from "node:test";
import assert from "node:assert/strict";
import { loadActivities } from "./storage.ts";
test("reads existing activity IDs and ignores malformed entries", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () =>
        JSON.stringify([
          null,
          42,
          {
            id: 12,
            activity: "feeding",
            date: "2026-10-15",
            from: "12:00",
            to: "12:00",
            note: "",
          },
        ]),
    },
  });
  try {
    assert.deepEqual(
      loadActivities().map((item) => item.id),
      ["12"],
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
