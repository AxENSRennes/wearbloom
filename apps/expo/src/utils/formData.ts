export async function appendLocalImage(
  formData: FormData,
  key: string,
  uri: string,
  filename: string,
): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("LOCAL_IMAGE_READ_FAILED");
  }

  const blob = await response.blob();
  formData.append(key, blob, filename);
}
