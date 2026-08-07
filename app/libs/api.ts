const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://kafai-api.vercel.app/api";
export const API_BASE_URL = rawApiUrl.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '');


export interface AuthResponse {
  message?: string;
  token?: string;
  expiresIn?: string;
  userId?: string;
  error?: string;
}

export interface KafaiRecord {
  _id: string;
  userId: string;
  recordedAt: string;
  targetDate: string;
  unit: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function loginApi(username: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || `Error ${res.status}: Failed to login` };
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    return data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}

export async function registerApi(username: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || `Error ${res.status}: Failed to register` };
    }

    return data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function getKafaiListApi(): Promise<{ data?: KafaiRecord[]; error?: string; status?: number }> {
  const token = getToken();
  if (!token) return { error: "No authentication token found", status: 401 };

  try {
    const res = await fetch(`${API_BASE_URL}/kafai`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "Failed to fetch electric records", status: res.status };
    }

    return { data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}

export async function addKafaiApi(payload: {
  recordedAt: string;
  targetDate: string;
  unit: number;
}): Promise<{ data?: KafaiRecord; error?: string; status?: number }> {
  const token = getToken();
  if (!token) return { error: "No authentication token found", status: 401 };

  try {
    const res = await fetch(`${API_BASE_URL}/kafai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "Failed to add electric record", status: res.status };
    }

    return { data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}

export async function updateKafaiApi(
  id: string,
  payload: Partial<{ recordedAt: string; targetDate: string; unit: number }>
): Promise<{ data?: KafaiRecord; error?: string; status?: number }> {
  const token = getToken();
  if (!token) return { error: "No authentication token found", status: 401 };

  try {
    const res = await fetch(`${API_BASE_URL}/kafai/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "Failed to update record", status: res.status };
    }

    return { data };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}

export async function deleteKafaiApi(id: string): Promise<{ success?: boolean; error?: string; status?: number }> {
  const token = getToken();
  if (!token) return { error: "No authentication token found", status: 401 };

  try {
    const res = await fetch(`${API_BASE_URL}/kafai/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || "Failed to delete record", status: res.status };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Connection error";
    return { error: `Failed to connect to backend (${API_BASE_URL}). ${errorMessage}` };
  }
}
