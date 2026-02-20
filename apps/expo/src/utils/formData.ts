interface ReactNativeFormDataFile {
  uri: string;
  name: string;
  type: string;
}

const LOCAL_URI_PREFIXES = [
  "file://",
  "content://",
  "ph://",
  "assets-library://",
] as const;

function isLocalNativeUri(uri: string): boolean {
  const normalizedUri = uri.toLowerCase();
  return LOCAL_URI_PREFIXES.some((prefix) =>
    normalizedUri.startsWith(prefix),
  );
}

function inferImageMimeType(uri: string, filename: string): string {
  const value = `${filename} ${uri}`.toLowerCase();

  if (value.includes(".png")) {
    return "image/png";
  }

  if (value.includes(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function appendLocalImage(
  formData: FormData,
  key: string,
  uri: string,
  filename: string,
): Promise<void> {
  if (isLocalNativeUri(uri)) {
    const localFile: ReactNativeFormDataFile = {
      uri,
      name: filename,
      type: inferImageMimeType(uri, filename),
    };
    formData.append(key, localFile as unknown as Blob);
    return;
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("LOCAL_IMAGE_READ_FAILED");
  }

  const blob = await response.blob();
  const hasUsableMimeType =
    blob.type.length > 0 && blob.type !== "application/octet-stream";
  const mimeType = hasUsableMimeType
    ? blob.type
    : inferImageMimeType(uri, filename);

  const normalizedBlob =
    blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);

  formData.append(key, normalizedBlob, filename);
}
