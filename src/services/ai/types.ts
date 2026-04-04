export interface ChatResponse {
    reply: string;
    sources?: string[];
    isMock?: boolean;
    action?: {
        type: 'NAVIGATE' | 'SELL_MEDICINE' | 'SHARE_WHATSAPP' | 'ADD_TO_SHORTBOOK' | 'NAVIGATE_POS' | 'NAVIGATE_INVENTORY' | 'OPEN_WHATSAPP';
        payload: any;
    };
    navigationPath?: string;
}

export interface ComplianceResult {
    is_banned: boolean;
    is_h1: boolean;
    reason?: string;
    warning_level?: string;
}

export interface MarketData {
    drug_name: string;
    avg_price: number;
    substitutes: {
        name: string;
        generic_name: string;
        price: number;
        margin_percentage: number;
        savings: number;
    }[];
}
