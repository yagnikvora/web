import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// Whether the shared store is reachable and writable. A static segment, so it resolves here
// rather than matching the [id] route below it as a trade called "sync".
export const GET = () => proxy("/momentum/journal/sync");
