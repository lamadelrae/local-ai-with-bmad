import { mergeTests } from "@playwright/test";
import { test as apiRequestFixture } from "@seontechnologies/playwright-utils/api-request/fixtures";
import { test as recurseFixture } from "@seontechnologies/playwright-utils/recurse/fixtures";
import { test as interceptFixture } from "@seontechnologies/playwright-utils/intercept-network-call/fixtures";
import { test as networkErrorMonitorFixture } from "@seontechnologies/playwright-utils/network-error-monitor/fixtures";

// No auth-session fixture: this app has no auth layer (single-user hobby project).
export const test = mergeTests(apiRequestFixture, recurseFixture, interceptFixture, networkErrorMonitorFixture);

export { expect } from "@playwright/test";
