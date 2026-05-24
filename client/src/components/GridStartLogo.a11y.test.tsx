import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../test/utils/test-utils";
import { run } from "axe-core";
import { GridStartLogo } from "./GridStartLogo";

describe("GridStartLogo Accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = renderWithProviders(<GridStartLogo />);
    const results = await run(container);

    expect(results.violations).toHaveLength(0);
  });
});