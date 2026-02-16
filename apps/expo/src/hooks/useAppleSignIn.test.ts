import { describe, expect, test } from "bun:test";

describe("useAppleSignIn — account linking verification", () => {
  test("uses ID token flow (not redirect OAuth) to preserve anonymous session", async () => {
    const source = await Bun.file(
      import.meta.dir + "/useAppleSignIn.ts",
    ).text();
    // ID token flow: signIn.social with idToken parameter
    expect(source).toContain("idToken:");
    expect(source).toContain("signIn.social");
    // Must NOT use redirect-based OAuth (callbackURL, redirectTo)
    expect(source).not.toContain("callbackURL");
    expect(source).not.toContain("redirectTo");
  });

  test("exports useAppleSignIn as a function", async () => {
    const { useAppleSignIn } = await import("./useAppleSignIn");
    expect(typeof useAppleSignIn).toBe("function");
  });

  test("returns mutation-like object with mutate and isPending", () => {
    // useAppleSignIn uses useMutation which is mocked in setup.ts
    const { useAppleSignIn } = require("./useAppleSignIn");
    const result = useAppleSignIn();
    expect(result).toHaveProperty("mutate");
    expect(result).toHaveProperty("isPending");
  });
});

describe("Account linking server config verification", () => {
  const authPath = import.meta.dir + "/../../../../packages/auth/src/index.ts";

  test("onLinkAccount callback is configured in auth package", async () => {
    const source = await Bun.file(authPath).text();
    expect(source).toContain("onLinkAccount");
    expect(source).toContain("anonymous(");
  });

  test("anonymous user auto-deletion is not disabled", async () => {
    const source = await Bun.file(authPath).text();
    expect(source).not.toContain("disableDeleteAnonymousUser");
  });
});
