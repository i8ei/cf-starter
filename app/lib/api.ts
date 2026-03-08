import { hc } from "hono/client";
import type { AppType } from "@server/index";

export const client = hc<AppType>("/");
