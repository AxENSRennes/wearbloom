import { describe, expect, test } from "bun:test";

import { queryClient } from "./api";

describe("QueryClient configuration", () => {
  test("gcTime is set to 24 hours for persist compatibility", () => {
    const defaults = queryClient.getDefaultOptions();
    const gcTime = defaults.queries?.gcTime;
    const twentyFourHoursMs = 1000 * 60 * 60 * 24;
    expect(gcTime).toBe(twentyFourHoursMs);
  });
});
