import config from "./config.js";
import httpClient from "./utils/httpClient.js";
import { logger } from "./utils/logger.js";
import { runPool, jitter } from "./utils/pool.js";

export async function getAllDekaIds(
  startYear: number,
  endYear: number,
  totalPages: number,
): Promise<string[]> {
  const resultList: string[] = [];
  const CONCURRENCY_LIMIT = config.GET_DEKA_ID_CONCURRENCY_LIMIT;

  logger.info(
    `Starting to fetch DEKA IDs for years ${startYear}-${endYear} with ${totalPages} pages`,
  );

  const fetchPageWithRetry = async (
    page: number,
    payload: URLSearchParams,
  ): Promise<string[]> => {
    const url = `${config.DEKA_BASE_URL}/search/index/${page}`;

    try {
      await jitter(config.REQUEST_JITTER_MS);
      const response = await httpClient.requestWithRetry<string>(
        url,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          body: payload.toString(),
        },
        config.RETRY_LIMIT,
        config.INITIAL_RETRY_DELAY_MS,
        config.MAX_RETRY_DELAY_MS,
      );

      const matches = response.data.match(/btn_print_\d+/g);
      return matches
        ? matches.map((item) => item.replace("btn_print_", ""))
        : [];
    } catch (error: any) {
      logger.error(`Failed to fetch page ${page} after all retries`, error);
      return []; // Return empty array to prevent Promise.all from failing
    }
  };

  try {
    const payload = new URLSearchParams();
    payload.append("search_form_type", "basic");
    payload.append("start", "true");
    payload.append("search_type", "1");
    payload.append("search_deka_start_year", startYear.toString());
    payload.append("search_deka_end_year", endYear.toString());

    // Stream all pages through a worker pool — workers pull the next page as soon
    // as they finish, so a single slow page never stalls the others.
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    const pageResults = await runPool(
      pages,
      CONCURRENCY_LIMIT,
      (page) => fetchPageWithRetry(page, payload),
      (ids, page, _index, { completed, total }) => {
        if (ids.length > 0) {
          logger.info(
            `  📄 Page ${page}: Found ${ids.length} records (${completed}/${total} pages)`,
          );
        } else {
          logger.warn(
            `  📄 Page ${page}: No data found or error occurred (${completed}/${total} pages)`,
          );
        }
      },
    );

    pageResults.forEach((ids) => resultList.push(...ids));

    const uniqueIds = [...new Set(resultList)];
    logger.info(
      `✅ Completed! Successfully collected ${uniqueIds.length} unique IDs`,
    );
    return uniqueIds;
  } catch (error) {
    logger.error("❌ Critical error in getAllDekaIds", error);
    return []; // Return empty array to match Promise<string[]> type
  }
}
