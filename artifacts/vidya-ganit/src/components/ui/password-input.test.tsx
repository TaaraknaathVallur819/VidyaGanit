import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordInput } from "./password-input";

describe("password input", () => {
  it("starts masked and preserves form, autocomplete and accessible toggle semantics", () => {
    const html = renderToStaticMarkup(
      <PasswordInput
        id="password"
        name="password"
        required
        autoComplete="current-password"
        showLabel="Show password"
        hideLabel="Hide password"
      />,
    );
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('name="password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-controls="password"');
    expect(html).toContain('type="button"');
  });
  it("disables both the input and toggle when requested", () => {
    const html = renderToStaticMarkup(
      <PasswordInput
        disabled
        showLabel="Show password"
        hideLabel="Hide password"
      />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
