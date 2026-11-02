import { supabaseRequest } from "./supabase-admin.js";

/**
 * 100-Day Automatic Cleanup Routine for Fabric Stain Photos
 * Deletes images older than 100 days from Supabase order-stains bucket.
 */
export async function cleanupExpiredStainPhotos(logger?: any) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 100);
    const cutoffTime = cutoffDate.getTime();

    // 1. List objects in order-stains bucket
    const objects = await supabaseRequest<any[]>(
      "/storage/v1/object/list/order-stains",
      "POST",
      { prefix: "", limit: 1000, sortBy: { column: "created_at", order: "asc" } }
    ).catch(() => []);

    if (!Array.isArray(objects) || objects.length === 0) {
      logger?.info?.("[Storage Cleanup] No stain objects found or bucket empty.");
      return;
    }

    const expiredNames: string[] = [];
    for (const obj of objects) {
      const createdTime = obj.created_at ? new Date(obj.created_at).getTime() : 0;
      if (createdTime > 0 && createdTime < cutoffTime) {
        expiredNames.push(obj.name);
      }
    }

    if (expiredNames.length > 0) {
      logger?.info?.(`[Storage Cleanup] Deleting ${expiredNames.length} expired stain photo(s) older than 100 days.`);
      await supabaseRequest(
        "/storage/v1/object/order-stains",
        "DELETE",
        { prefixes: expiredNames }
      );
    } else {
      logger?.info?.("[Storage Cleanup] All stain photos are within the 100-day retention window.");
    }
  } catch (err: any) {
    logger?.error?.(err, "[Storage Cleanup] Error during expired stain photo sweep");
  }
}
