-- Add moderation columns to support_messages table
-- Run this migration to add moderation tracking to support messages

ALTER TABLE support_messages
ADD COLUMN IF NOT EXISTS moderation_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS moderation_severity VARCHAR(20) DEFAULT 'LOW',
ADD COLUMN IF NOT EXISTS moderation_categories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS moderation_flags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS moderation_priority BOOLEAN DEFAULT false;

-- Add index for priority conversations
CREATE INDEX IF NOT EXISTS idx_support_messages_priority
ON support_messages(moderation_priority, created_at DESC)
WHERE moderation_priority = true;

-- Add index for severity filtering
CREATE INDEX IF NOT EXISTS idx_support_messages_severity
ON support_messages(moderation_severity, created_at DESC);
