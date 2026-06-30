ALTER TABLE support_messages
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL',
ADD COLUMN IF NOT EXISTS suggested_queue VARCHAR(30) NOT NULL DEFAULT 'GENERAL_SUPPORT';

CREATE INDEX IF NOT EXISTS idx_support_messages_suggested_queue
ON support_messages(suggested_queue, created_at DESC);
