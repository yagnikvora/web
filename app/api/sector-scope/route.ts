import { proxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export const GET = () => proxy("/api_be/data/sector_scope");
