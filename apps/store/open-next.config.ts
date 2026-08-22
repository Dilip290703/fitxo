// OpenNext adapter config — turns the Next build into a Cloudflare Worker.
//
// No incrementalCache override on purpose: the docs suggest an R2 bucket, which
// only earns its cost once there are pages worth caching between deploys. Every
// page in this panel is authenticated and dynamic, so it would cache nothing.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
