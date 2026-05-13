import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../utils/test-utils";
import { GridStartLogo } from "../../components/GridStartLogo";

describe("GridStartLogo Component", () => {
  it("should render without crashing", () => {
    renderWithProviders(<GridStartLogo />);
    expect(document.body).toBeInTheDocument();
  });

  it("should render the logo SVG element", () => {
    const { container } = renderWithProviders(<GridStartLogo />);
    const logo = container.querySelector("svg");
    expect(logo).toBeInTheDocument();
  });

  it("should have correct aria-label", () => {
    const { container } = renderWithProviders(<GridStartLogo />);
    const logo = container.querySelector('svg[aria-label="GridStart logo"]');
    expect(logo).toBeInTheDocument();
  });
});
