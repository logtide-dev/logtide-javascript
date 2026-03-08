/**
 * HTTP upload utility for source map files.
 */

export interface UploadResult {
  success: boolean;
  fileName: string;
  error?: string;
}

export async function uploadSourceMap(params: {
  apiUrl: string;
  apiKey: string;
  release: string;
  fileName: string;
  content: Buffer;
}): Promise<UploadResult> {
  const { apiUrl, apiKey, release, fileName, content } = params;

  const formData = new FormData();
  formData.append('release', release);
  formData.append('fileName', fileName);
  formData.append('file', new Blob([content], { type: 'application/octet-stream' }), fileName);

  const url = `${apiUrl.replace(/\/$/, '')}/api/v1/sourcemaps`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    let errorMsg: string;
    try {
      const body = await response.json();
      errorMsg = body.error || body.message || `HTTP ${response.status}`;
    } catch {
      errorMsg = `HTTP ${response.status} ${response.statusText}`;
    }
    return { success: false, fileName, error: errorMsg };
  }

  return { success: true, fileName };
}
