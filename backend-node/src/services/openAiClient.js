import OpenAI from "openai";

let cachedClient = null;

export class OpenAiServiceError extends Error {
  constructor(message, statusCode = 500, code = "openai_service_error") {
    super(message);
    this.name = "OpenAiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new OpenAiServiceError(
      "OPENAI_API_KEY is missing. Add it to your environment before scanning.",
      500,
      "missing_api_key"
    );
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return cachedClient;
}

export function imageToDataUrl(buffer, mimeType) {
  if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
    throw new OpenAiServiceError("Uploaded image is empty or invalid.", 400, "invalid_upload");
  }

  if (!mimeType || !mimeType.startsWith("image/")) {
    throw new OpenAiServiceError("Only image uploads are supported.", 400, "invalid_upload");
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function extractJsonText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return "";
  }

  const chunks = [];
  for (const item of response.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export function parseJsonOutput(response, errorCode = "malformed_model_response") {
  const jsonText = extractJsonText(response);
  if (!jsonText) {
    throw new OpenAiServiceError("OpenAI returned an empty JSON response.", 502, "empty_model_response");
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new OpenAiServiceError("OpenAI returned malformed JSON.", 502, errorCode);
  }
}

export function wrapOpenAiError(error, fallbackMessage, fallbackCode) {
  if (error instanceof OpenAiServiceError) {
    throw error;
  }

  if (error?.status === 401) {
    throw new OpenAiServiceError(
      "OpenAI authentication failed. Verify OPENAI_API_KEY.",
      500,
      "openai_auth_error"
    );
  }

  throw new OpenAiServiceError(fallbackMessage, 502, fallbackCode);
}
