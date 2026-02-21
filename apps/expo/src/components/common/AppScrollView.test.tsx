import { View } from "react-native";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppScrollView } from "~/components/common/AppScrollView";

describe("AppScrollView", () => {
  test("applies normalized scroll behavior defaults", () => {
    const html = renderToStaticMarkup(
      <AppScrollView screen="test-screen">
        <View />
      </AppScrollView>,
    );

    expect(html).toContain("mock-ScrollView");
    expect(html).toContain("bounces");
    expect(html).toContain("alwaysBounceVertical");
    expect(html).toContain('overScrollMode="always"');
    expect(html).toContain('scrollEventThrottle="16"');
  });
});
