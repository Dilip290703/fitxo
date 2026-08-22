// OpenNext adapter config — turns the Next build into a Cloudflare Worker.
//
// No incrementalCache override on purpose: the docs' default suggestion is an R2
// bucket, which is only worth paying for once there are pages worth caching
// between deploys. Every page here that matters is authenticated and dynamic
// (cart, order tracking, try-window), so it would cache almost nothing.
// Revisit if the catalog pages become ISR.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
