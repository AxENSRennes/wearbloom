import { createElement } from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AddAction, AddState } from "./add";
import AddGarmentScreen, { addGarmentReducer } from "./add";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

// ---------------------------------------------------------------------------
// Reducer unit tests
// ---------------------------------------------------------------------------

describe("addGarmentReducer", () => {
  const idleState: AddState = { step: "idle" };

  const previewingState: AddState = {
    step: "previewing",
    imageUri: "file:///photo.jpg",
    width: 1200,
    height: 1600,
  };

  const uploadingState: AddState = {
    step: "uploading",
    imageUri: "file:///photo.jpg",
    width: 1200,
    height: 1600,
    category: "tops",
  };

  test("PHOTO_SELECTED transitions from idle to previewing with image data", () => {
    const action: AddAction = {
      type: "PHOTO_SELECTED",
      uri: "file:///camera/img_001.jpg",
      width: 3000,
      height: 4000,
    };

    const next = addGarmentReducer(idleState, action);

    expect(next.step).toBe("previewing");
    expect(next).toEqual({
      step: "previewing",
      imageUri: "file:///camera/img_001.jpg",
      width: 3000,
      height: 4000,
    });
  });

  test("PHOTO_SELECTED transitions from previewing to previewing (re-select photo)", () => {
    const action: AddAction = {
      type: "PHOTO_SELECTED",
      uri: "file:///new_photo.jpg",
      width: 800,
      height: 600,
    };

    const next = addGarmentReducer(previewingState, action);

    expect(next.step).toBe("previewing");
    expect(next).toEqual({
      step: "previewing",
      imageUri: "file:///new_photo.jpg",
      width: 800,
      height: 600,
    });
  });

  test("UPLOAD_START transitions from previewing to uploading with category", () => {
    const action: AddAction = { type: "UPLOAD_START", category: "dresses" };

    const next = addGarmentReducer(previewingState, action);

    expect(next.step).toBe("uploading");
    expect(next).toEqual({
      step: "uploading",
      imageUri: "file:///photo.jpg",
      width: 1200,
      height: 1600,
      category: "dresses",
    });
  });

  test("UPLOAD_START preserves image data from previewing state", () => {
    const action: AddAction = { type: "UPLOAD_START", category: "shoes" };

    const next = addGarmentReducer(previewingState, action);

    expect(next.step).toBe("uploading");
    if (next.step === "uploading") {
      expect(next.imageUri).toBe(previewingState.imageUri);
      expect(next.width).toBe(previewingState.width);
      expect(next.height).toBe(previewingState.height);
    }
  });

  test("UPLOAD_START from non-previewing state defaults to empty values", () => {
    const action: AddAction = { type: "UPLOAD_START", category: "tops" };

    const next = addGarmentReducer(idleState, action);

    expect(next.step).toBe("uploading");
    expect(next).toEqual({
      step: "uploading",
      imageUri: "",
      width: 0,
      height: 0,
      category: "tops",
    });
  });

  test("UPLOAD_SUCCESS transitions to success with garmentId", () => {
    const action: AddAction = {
      type: "UPLOAD_SUCCESS",
      garmentId: "garment_abc123",
    };

    const next = addGarmentReducer(uploadingState, action);

    expect(next.step).toBe("success");
    expect(next).toEqual({
      step: "success",
      garmentId: "garment_abc123",
    });
  });

  test("UPLOAD_ERROR transitions from uploading back to previewing preserving dimensions", () => {
    const action: AddAction = { type: "UPLOAD_ERROR" };

    const next = addGarmentReducer(uploadingState, action);

    expect(next.step).toBe("previewing");
    expect(next).toEqual({
      step: "previewing",
      imageUri: uploadingState.imageUri,
      width: uploadingState.width,
      height: uploadingState.height,
    });
  });

  test("UPLOAD_ERROR from non-uploading state returns current state unchanged", () => {
    const action: AddAction = { type: "UPLOAD_ERROR" };

    const next = addGarmentReducer(previewingState, action);

    expect(next).toBe(previewingState);
  });

  test("UPLOAD_ERROR from idle state returns idle unchanged", () => {
    const action: AddAction = { type: "UPLOAD_ERROR" };

    const next = addGarmentReducer(idleState, action);

    expect(next).toBe(idleState);
  });

  test("RETAKE transitions back to idle", () => {
    const action: AddAction = { type: "RETAKE" };

    const next = addGarmentReducer(previewingState, action);

    expect(next).toEqual({ step: "idle" });
  });

  test("RETAKE from uploading transitions back to idle", () => {
    const action: AddAction = { type: "RETAKE" };

    const next = addGarmentReducer(uploadingState, action);

    expect(next).toEqual({ step: "idle" });
  });

  test("ADD_ANOTHER transitions back to idle", () => {
    const successState: AddState = {
      step: "success",
      garmentId: "garment_xyz",
    };
    const action: AddAction = { type: "ADD_ANOTHER" };

    const next = addGarmentReducer(successState, action);

    expect(next).toEqual({ step: "idle" });
  });

  test("ADD_ANOTHER from idle returns idle", () => {
    const action: AddAction = { type: "ADD_ANOTHER" };

    const next = addGarmentReducer(idleState, action);

    expect(next).toEqual({ step: "idle" });
  });
});

// ---------------------------------------------------------------------------
// Component integration tests
// ---------------------------------------------------------------------------

describe("AddGarmentScreen", () => {
  test("exports a function component", () => {
    expect(typeof AddGarmentScreen).toBe("function");
  });

  test("renders initial idle screen with 'Add a Garment' heading", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain("Add a Garment");
  });

  test("renders instruction text for photo capture", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain(
      "Take a photo of your garment or import one from your gallery.",
    );
  });

  test("renders Add Garment button on idle screen", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain("Add Garment");
  });

  test("renders ActionSheet component for source selection", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain("mock-ActionSheet");
  });

  test("uses SafeAreaView as root container", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toMatch(/^<mock-SafeAreaView/);
  });

  test("renders heading with heading variant", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain('variant="heading"');
  });
});

// ---------------------------------------------------------------------------
// Story 3.5: Supported categories integration
// ---------------------------------------------------------------------------

describe("AddGarmentScreen — Story 3.5 integration", () => {
  test("renders idle screen without crash when supportedCategories query returns default", () => {
    // useQuery mock (from preload) returns data: null → supportedCategories = []
    // With the empty-guard fix, unsupportedCategories = [] (no categories marked)
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain("Add a Garment");
    // CategoryPills is NOT rendered in idle state, so no "No try-on" badges
    expect(html).not.toContain("No try-on");
  });

  test("renders photography tips section in idle state", () => {
    const html = render(createElement(AddGarmentScreen));
    expect(html).toContain("Tips for best results");
  });

  test("uses tabs root route for Browse Wardrobe success navigation", async () => {
    const source = await Bun.file(import.meta.dir + "/add.tsx").text();
    expect(source).toContain('const WARDROBE_ROUTE = "/(auth)/(tabs)/"');
    expect(source).toContain("router.push(WARDROBE_ROUTE)");
    expect(source).not.toContain('/(auth)/(tabs)/home');
  });
});
