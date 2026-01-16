-- Enable pg_trgm extension for text similarity search (Required for Marketplace RPC)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
