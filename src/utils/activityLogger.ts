import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

export type ActionType = 'LOGIN' | 'SALE' | 'RESTOCK' | 'SETTINGS_UPDATE' | 'EXPORT' | 'DELETE';
export type EntityType = 'INVENTORY' | 'ORDER' | 'USER' | 'SETTINGS' | 'CUSTOMER';

interface ActivityLogEntry {
    action: ActionType;
    entity: EntityType;
    entityId?: string;
    description: string;
    details?: any;
    shopId: string;
}

export const logActivity = async ({ action, entity, entityId, description, details, shopId }: ActivityLogEntry) => {
    try {
        const { error } = await supabase.from('activity_logs').insert({
            shop_id: shopId,
            action_type: action,
            entity_type: entity,
            entity_id: entityId,
            details: { ...details, description }, // Merge description into details for flexibility
        });

        if (error) {
            logger.error("Failed to log activity:", error);
        }
    } catch (e) {
        logger.error("Error logging activity:", e);
    }
};
