const raw =
  process.env.NEXT_PUBLIC_API_URL || "https://kafai-api.vercel.app/api";
export const API_BASE_URL = raw
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/$/, "");
export interface AuthResponse {
  message?: string;
  token?: string;
  userId?: string;
  error?: string;
}
export interface KafaiRecord {
  _id: string;
  userId: string;
  recordedAt: string;
  recordType?: "meter_reading" | "legacy_usage";
  meterReading?: number;
  unit?: number;
  cycle?: number;
  modulus?: number;
  seriesId?: string;
  source?: "measured" | "reconstructed";
  migrationId?: string;
  dateChanged?: boolean;
  updatedAt?: string;
  createdAt?: string;
}
export interface ReadingInput {
  recordedAt: string;
  meterReading?: number;
  unit?: number;
  seriesId?: string;
  cycle?: number;
  modulus?: number;
  confirmRollover?: boolean;
  updatedAt?: string;
}
export interface MigrationInput {
  startAt: string;
  anchorAt: string;
  anchorReading: number;
  modulus: number;
  fingerprint?: string;
}
export interface MigrationPreview {
  entries: KafaiRecord[];
  total: number;
  count: number;
  warning: string;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  authenticated = true,
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (authenticated && !token) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("kafai:unauthorized"));
    throw new ApiError("กรุณาเข้าสู่ระบบ", 401);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Kafai-Version": "2",
        ...(token && authenticated ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง",
      0,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (authenticated && res.status === 401) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("kafai:unauthorized"));
    }
    throw new ApiError(
      data.error || `เกิดข้อผิดพลาด (${res.status})`,
      res.status,
    );
  }
  return data as T;
}
async function auth(
  path: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  try {
    const data = await request<AuthResponse>(
      path,
      "POST",
      { username, password },
      false,
    );
    if (data.token) localStorage.setItem("token", data.token);
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ" };
  }
}
export const loginApi = (u: string, p: string) => auth("/auth/login", u, p);
export const registerApi = (u: string, p: string) =>
  auth("/auth/register", u, p);
export const getRecords = () => request<KafaiRecord[]>("/kafai");
export const saveRecord = (body: ReadingInput, id?: string) =>
  request<KafaiRecord>(
    `/kafai${id ? `/${id}` : ""}`,
    id ? "PUT" : "POST",
    body,
  );
export const deleteRecord = (record: KafaiRecord) =>
  request(`/kafai/${record._id}`, "DELETE", { updatedAt: record.updatedAt });
export function accountKey() {
  try {
    return JSON.parse(
      atob(
        (localStorage.getItem("token") || "")
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
    ).userId as string;
  } catch {
    return "unknown";
  }
}
