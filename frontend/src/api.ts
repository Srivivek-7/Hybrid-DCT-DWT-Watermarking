const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type Metrics = {
  PSNR_dB: number;
  SSIM: number;
  NC: number;
  BER: number;
};

export type ComparisonItem = Metrics;

export type RobustnessResult = Metrics & {
  attack: string;
  strength: number;
};

export type ProcessResponse = {
  metrics: Metrics;
  watermarked_image: string;
  extracted_watermark: string;
  color_preserved: boolean;
};

function readError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const data = payload as { detail?: unknown; error?: unknown };

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    const parts = data.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return "";
      })
      .filter(Boolean);

    if (parts.length) {
      return parts.join(", ");
    }
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  return fallback;
}

async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = await response.json();
      throw new Error(readError(payload, `Request failed (${response.status})`));
    }

    throw new Error(`Request failed (${response.status})`);
  }

  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, init);
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await apiRequest(path, init);
  return response.blob();
}

export function base64ToBlob(value: string, type = "image/png"): Blob {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export async function checkHealth(): Promise<boolean> {
  try {
    const data = await apiJson<{ status: string }>("/health");
    return data.status === "healthy";
  } catch {
    return false;
  }
}
export type Experiment = {
  id: number;
  algorithm: string;
  alpha: number;
  psnr: number;
  ssim: number;
  nc: number;
  ber: number;
  created_at: string;
};

export async function createExperiment(
  experiment: Omit<Experiment, "id" | "created_at">
): Promise<Experiment> {
  const token = localStorage.getItem("watermark_access_token");

  if (!token) {
    throw new Error("You must be logged in.");
  }

  return apiJson<Experiment>("/experiments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(experiment),
  });
}

export async function getExperiments(): Promise<Experiment[]> {
  const token = localStorage.getItem("watermark_access_token");

  if (!token) {
    return [];
  }

  return apiJson<Experiment[]>("/experiments", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function deleteExperiment(
  id: number
): Promise<void> {
  const token = localStorage.getItem("watermark_access_token");

  if (!token) {
    throw new Error("You must be logged in.");
  }

  await apiRequest(`/experiments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}