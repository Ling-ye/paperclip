import type { Db } from "@paperclipai/db";
import { githubChatReviewService } from "../../chat-github-reviews.js";
import { githubResponseCommentService } from "../../chat-github-response-comments.js";
import { githubReviewCheckService } from "../../chat-github-checks.js";

export function createGitHubMaintenance(db: Db, fetchImpl: typeof globalThis.fetch, options: {
  idleOptimizations?: boolean;
  scheduleMessageProcessing: (task: () => Promise<void>) => void;
  isShuttingDown: () => boolean;
}) {
  const createServices = () => ({
    reviews: githubChatReviewService(db, fetchImpl),
    responses: githubResponseCommentService(db, fetchImpl),
    checks: githubReviewCheckService(db, fetchImpl),
  });
  const retainedServices = options.idleOptimizations ? createServices() : null;
  let githubMaintenancePending = false;
  function scheduleGitHubMaintenance() {
    if (githubMaintenancePending || options.isShuttingDown()) return;
    githubMaintenancePending = true;
    options.scheduleMessageProcessing(async () => {
      try {
        // Provider I/O must not block Slack, Teams, or ordinary message receipts.
        const services = retainedServices ?? createServices();
        await services.reviews.processPending();
        await services.responses.processPending();
        await services.checks.processPending();
      } finally {
        githubMaintenancePending = false;
      }
    });
  }

  return { scheduleGitHubMaintenance };
}
