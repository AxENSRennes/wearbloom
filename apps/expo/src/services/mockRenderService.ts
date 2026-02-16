// TODO(Epic-3): Replace with real tryon.requestRender via ephemeralProcedure

/**
 * Mock render service that simulates the AI try-on render pipeline.
 * Returns the body photo as the "render result" (placeholder) after a delay.
 *
 * When Epic 3 is implemented, replace with:
 * ```typescript
 * const result = await api.tryon.requestRender.mutate({
 *   garmentId: selectedGarment.id,
 * });
 * ```
 */
export async function mockRequestRender(
  bodyPhotoUri: string,
  _garmentUri: string,
): Promise<{ resultUri: string }> {
  // Simulate 3-5s render delay
  const delay = 3000 + Math.random() * 2000;
  await new Promise((resolve) => setTimeout(resolve, delay));
  // Return the body photo as the "render result" (placeholder)
  return { resultUri: bodyPhotoUri };
}
