-- ==========================================
-- VOLTA DATABASE SCHEMA v2 (UUID PRODUCTS)
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== ENUMS ====================

CREATE TYPE user_role AS ENUM (
    'CUSTOMER',
    'ADMIN',
    'SUPPORT'
);

CREATE TYPE promotion_type AS ENUM (
    'product',
    'info',
    'image'
);

CREATE TYPE order_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);

-- ==================== USERS ====================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'CUSTOMER',
    points INTEGER DEFAULT 0,
    stripe_customer_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ADDRESSES ====================

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    label VARCHAR(50) NOT NULL,

    street VARCHAR(255) NOT NULL,
    number VARCHAR(20) DEFAULT '',
    colony VARCHAR(100) DEFAULT '',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(10),
    country VARCHAR(2) DEFAULT 'MX',

    is_default BOOLEAN DEFAULT FALSE,
    reference_notes TEXT DEFAULT '',

    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== VEHICLES ====================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    engine VARCHAR(50),

    plate VARCHAR(20),
    vin VARCHAR(17),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CATEGORIES ====================

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon TEXT
);

-- ==================== BRANDS ====================

CREATE TABLE brands (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PRODUCTS ====================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(255) NOT NULL,

    brand_id VARCHAR(50) NOT NULL
        REFERENCES brands(id),

    category_id VARCHAR(50) NOT NULL
        REFERENCES categories(id),

    price DECIMAL(10,2) NOT NULL,

    image VARCHAR(500),

    available BOOLEAN DEFAULT TRUE,

    description TEXT,

    discount_percent DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PROMOTIONS ====================

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    type promotion_type NOT NULL,

    eyebrow VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,

    link VARCHAR(255),

    image VARCHAR(500),
    icon VARCHAR(50),

    product_id UUID
        REFERENCES products(id),

    ai_search BOOLEAN DEFAULT FALSE,

    sort_order INTEGER DEFAULT 0,

    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== VEHICLE COMPATIBILITY ====================

CREATE TABLE vehicle_compatibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    product_id UUID NOT NULL
        REFERENCES products(id)
        ON DELETE CASCADE,

    brands TEXT[],

    models JSONB,

    year_start INTEGER,
    year_end INTEGER,

    engines TEXT[],

    oem_numbers TEXT[]
);

-- ==================== ORDERS ====================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL
        REFERENCES users(id),

    address_id UUID
        REFERENCES addresses(id),

    warehouse_id UUID
        REFERENCES warehouses(id),

    status order_status DEFAULT 'PENDING',

    total DECIMAL(10,2) NOT NULL,

    notes TEXT,

    tracking_data JSONB,

    shipping_cost DECIMAL(10,2) DEFAULT 0,

    points_discount DECIMAL(10,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ORDER ITEMS ====================

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    order_id UUID NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id UUID NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL CHECK (quantity > 0),

    price DECIMAL(10,2) NOT NULL,

    snapshot JSONB
);

-- ==================== CHAT SESSIONS ====================

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID
        REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CHAT MESSAGES ====================

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    session_id UUID NOT NULL
        REFERENCES chat_sessions(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,

    content TEXT NOT NULL,

    token_count INTEGER,

    is_streaming_complete BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CHAT SESSIONS PREVIEW VIEW ====================

CREATE OR REPLACE VIEW chat_sessions_preview AS
SELECT
    s.id,
    COALESCE(
        (SELECT SUBSTRING(content FROM 1 FOR 50)
         FROM chat_messages
         WHERE session_id = s.id
         ORDER BY created_at ASC
         LIMIT 1),
        'Nueva conversación'
    ) AS title,
    (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) AS message_count,
    (SELECT MAX(created_at) FROM chat_messages WHERE session_id = s.id) AS last_message_at,
    (
        SELECT content
        FROM chat_messages
        WHERE session_id = s.id AND role = 'assistant'
        ORDER BY created_at DESC
        LIMIT 1
    ) AS last_assistant_preview
FROM chat_sessions s;

-- ==================== FAVORITES ====================

CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- ================== NOTIFICATIONS ==================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'bell',
    read BOOLEAN DEFAULT FALSE,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouses (CEDIS) table
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    phone VARCHAR(20),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory: stock per product per warehouse
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, warehouse_id)
);


-- ==================== INDEXES ====================

CREATE INDEX idx_products_category
    ON products(category_id);

CREATE INDEX idx_products_brand
    ON products(brand_id);

CREATE INDEX idx_products_available
    ON products(available);

CREATE INDEX idx_addresses_user
    ON addresses(user_id);

CREATE INDEX idx_vehicles_user
    ON vehicles(user_id);

CREATE INDEX idx_orders_user
    ON orders(user_id);

CREATE INDEX idx_orders_status
    ON orders(status);

CREATE INDEX idx_chat_messages_session
    ON chat_messages(session_id);

CREATE INDEX idx_vehicle_compatibility_product
    ON vehicle_compatibility(product_id);

CREATE INDEX idx_order_items_order
    ON order_items(order_id);

CREATE INDEX idx_order_items_product
    ON order_items(product_id);

CREATE INDEX idx_promotions_active
    ON promotions(active);

CREATE INDEX idx_promotions_sort_order
    ON promotions(sort_order);

CREATE INDEX idx_favorites_user
    ON favorites(user_id);

CREATE INDEX idx_favorites_product
    ON favorites(product_id);

CREATE INDEX idx_notifications_user
    ON notifications(user_id);

CREATE INDEX idx_notifications_read
    ON notifications(user_id, read);

CREATE INDEX idx_notifications_created
    ON notifications(user_id, created_at DESC);

CREATE INDEX idx_warehouses_active 
    ON warehouses(active);

CREATE INDEX idx_inventory_product 
    ON inventory(product_id);

CREATE INDEX idx_inventory_warehouse
    ON inventory(warehouse_id);

-- Support chat messages table
CREATE TABLE support_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_from_user BOOLEAN NOT NULL DEFAULT true,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Moderation data
    moderation_score INTEGER DEFAULT 0,
    moderation_severity VARCHAR(20) DEFAULT 'LOW',
    moderation_categories TEXT[] DEFAULT '{}',
    moderation_flags TEXT[] DEFAULT '{}',
    moderation_priority BOOLEAN DEFAULT false,
    sentiment VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL',
    suggested_queue VARCHAR(30) NOT NULL DEFAULT 'GENERAL_SUPPORT'
);

CREATE TABLE support_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ==================== ACTIVITY LOGS ====================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100),
    entity_id VARCHAR(255),
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


INSERT INTO support_settings (id, enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX idx_support_messages_user
    ON support_messages(user_id);

CREATE INDEX idx_support_messages_agent
    ON support_messages(sender_agent_id);

CREATE INDEX idx_support_messages_created
    ON support_messages(user_id, created_at DESC);

CREATE INDEX idx_support_messages_unread
    ON support_messages(is_read) WHERE is_read = false AND is_from_user = false;

CREATE INDEX idx_activity_logs_user
    ON activity_logs(user_id);

CREATE INDEX idx_activity_logs_action
    ON activity_logs(action);

CREATE INDEX idx_activity_logs_created
    ON activity_logs(created_at DESC);

CREATE INDEX idx_activity_logs_user_action
    ON activity_logs(user_id, action);
