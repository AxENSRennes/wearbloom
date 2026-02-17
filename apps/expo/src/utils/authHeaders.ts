import { authClient } from "./auth";

export function getAuthHeaders(): { Cookie: string } | undefined {
  const cookies = authClient.getCookie();
  return cookies ? { Cookie: cookies } : undefined;
}
