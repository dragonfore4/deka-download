import fs from "fs";
import path from "path";
import config from "./config.js";
import httpClient from "./utils/httpClient.js";
import { logger } from "./utils/logger.js";
import { checkpointManager } from "./utils/checkpointManager.js";

function buildPayload(docId: string) {
  const payload = new URLSearchParams();
  payload.append("docid", docId);
  payload.append("pdekano", "1");
  payload.append("plitigant", "1");
  payload.append("plaw", "1");
  payload.append("pshorttext", "1");
  payload.append("plongtext", "1");
  payload.append("pjudge", "1");
  payload.append("pprimarycourt", "1");
  payload.append("psource", "1");
  payload.append("pdepartment", "1");
  payload.append("pprimarycourtdekano", "1");
  payload.append("premark", "1");
  return payload;
}

function ensureDownloadPath(folderName: string) {
  const downloadPath = path.join(config.DOWNLOAD_DIR, folderName);

  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  return downloadPath;
}

function looksLikePdf(contentType: string, body: ArrayBuffer) {
  return (
    contentType.includes("application/pdf") ||
    Buffer.from(body).slice(0, 4).toString("utf8") === "%PDF"
  );
}

function prepareHtmlForGotenberg(htmlContent: string) {
  const styleBlock = `
    <style>
      .navbar { display: none !important; }
      body { padding-top: 0 !important; margin: 0 !important; background: white !important; }
      page[size="A4"] { margin-top: 0 !important; box-shadow: none !important; }
    </style>
  `;
  const baseTag = '<base href="https://deka.supremecourt.or.th/">';

  if (htmlContent.includes("</head>")) {
    return htmlContent.replace("</head>", `${baseTag}${styleBlock}</head>`);
  }

  return `${styleBlock}${baseTag}${htmlContent}`;
}

async function renderWithGotenberg(htmlContent: string, filePath: string) {
  if (!config.ENABLE_GOTENBERG) {
    throw new Error("Gotenberg is disabled in configuration");
  }

  const formData = new FormData();
  formData.append(
    "files",
    new Blob([prepareHtmlForGotenberg(htmlContent)], { type: "text/html" }),
    "index.html",
  );

  const response = await httpClient.requestWithRetry<ArrayBuffer>(
    config.GOTENBERG_HTML_URL,
    {
      method: "POST",
      body: formData,
    },
    config.RETRY_LIMIT,
    config.INITIAL_RETRY_DELAY_MS,
    config.MAX_RETRY_DELAY_MS,
  );

  if (
    !looksLikePdf(response.headers.get("content-type") || "", response.data)
  ) {
    throw new Error("Gotenberg returned a non-PDF response");
  }

  fs.writeFileSync(filePath, Buffer.from(response.data));
  logger.info(`✅ Converted successfully via Gotenberg: ${filePath}`);
}

export async function downloadDekaPDF(docId: string, folderName: string) {
  try {
    const payload = buildPayload(docId);
    const downloadPath = ensureDownloadPath(folderName);
    const filePath = path.join(downloadPath, `deka_${docId}.pdf`);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      logger.info(`⏭️  File already exists, skipping: ${filePath}`);
      return true;
    }

    const response = await httpClient.requestWithRetry<ArrayBuffer>(
      config.DEKA_PRINT_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: payload.toString(),
      },
      config.RETRY_LIMIT,
      config.INITIAL_RETRY_DELAY_MS,
      config.MAX_RETRY_DELAY_MS,
    );

    const contentType = response.headers.get("content-type") || "";

    if (looksLikePdf(contentType, response.data)) {
      fs.writeFileSync(filePath, Buffer.from(response.data));
      logger.info(`✅ Saved PDF directly from server: ${filePath}`);
      return true;
    }

    const htmlContent = Buffer.from(response.data).toString("utf8");
    logger.info(`Sending ID ${docId} for conversion with Gotenberg...`);

    await renderWithGotenberg(htmlContent, filePath);
    return true;
  } catch (error: any) {
    logger.error(`❌ Failed to download ID ${docId}`, error);
    return false;
  }
}
