/**
 * EV — taskpane entrypoint.
 *
 * Keep this file as thin as possible.
 *
 * MUST import `./boot.js` first:
 * - loads the first-party theme CSS
 * - installs compat patches (marked safety, theme mode, …)
 */

// MUST be first
import { EV_BUILD_ID } from "./build-info.js";
import "./boot.js";

console.info(`[EV] task pane build ${EV_BUILD_ID}`);

// Register first-party web components we rely on.
import "./ui/register-components.js";

// Custom tool + message renderers (Excel tools return markdown)
import "./ui/tool-renderers.js";
import "./ui/message-renderers.js";

import { bootstrapTaskpane } from "./taskpane/bootstrap.js";

bootstrapTaskpane();
