import { createElement } from "react";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { authClient } from "~/utils/auth";
import AuthLayout from "./_layout";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("AuthLayout", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders Slot when authenticated non-anonymous session", () => {
    spyOn(authClient, "useSession").mockReturnValue({
      data: { user: { isAnonymous: false, id: "user-1" }, session: {} },
      isPending: false,
      error: null,
    } as ReturnType<typeof authClient.useSession>);

    const html = render(createElement(AuthLayout));
    expect(html).toContain("mock-Slot");
  });

  test("redirects when no session", () => {
    spyOn(authClient, "useSession").mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    } as ReturnType<typeof authClient.useSession>);

    const html = render(createElement(AuthLayout));
    expect(html).toContain("mock-Redirect");
  });

  test("redirects when session is anonymous", () => {
    spyOn(authClient, "useSession").mockReturnValue({
      data: { user: { isAnonymous: true, id: "anon-1" }, session: {} },
      isPending: false,
      error: null,
    } as ReturnType<typeof authClient.useSession>);

    const html = render(createElement(AuthLayout));
    expect(html).toContain("mock-Redirect");
  });

  test("shows spinner when session is loading", () => {
    spyOn(authClient, "useSession").mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    } as ReturnType<typeof authClient.useSession>);

    const html = render(createElement(AuthLayout));
    expect(html).toContain("mock-Spinner");
  });
});
