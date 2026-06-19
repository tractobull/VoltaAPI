-- Volta API Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USUARIOS ====================

CREATE TYPE user_role AS ENUM ('CUSTOMER', 'ADMIN', 'SUPPORT');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'CUSTOMER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW().
    stripe_customer_id VARCHAR(255) UNIQUE
);

-- ==================== DIRECCIONES ====================

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- "Casa", "Trabajo", "Almacén"
    street VARCHAR(255) NOT NULL,
    number VARCHAR(20) DEFAULT '',
    colony VARCHAR(100) DEFAULT '',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    zip_code VARCHAR(10),
    country VARCHAR(2) DEFAULT 'MX',
    is_default BOOLEAN DEFAULT FALSE,
    reference_notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== VEHÍCULOS ====================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand VARCHAR(100) NOT NULL, -- Freightliner, Kenworth, Peterbilt
    model VARCHAR(100) NOT NULL, -- Cascadia, T680, 579
    year INTEGER NOT NULL,
    engine VARCHAR(50), -- DD13, DD15, ISX15
    plate VARCHAR(20),
    vin VARCHAR(17),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== CATEGORÍAS ====================

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50)
);

-- ==================== MARCAS ====================

CREATE TABLE brands (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo VARCHAR(255)
);

-- ==================== PRODUCTOS ====================

CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand_id VARCHAR(50) NOT NULL REFERENCES brands(id),
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id),
    price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(500),
    available BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== COMPATIBILIDAD VEHÍCULOS ====================

CREATE TABLE vehicle_compatibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(50) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    brands TEXT[], -- ["Freightliner", "Kenworth"]
    models JSONB, -- [{brand: "Freightliner", models: ["Cascadia"]}]
    year_start INTEGER,
    year_end INTEGER,
    engines TEXT[], -- ["DD13", "DD15"]
    oem_numbers TEXT[]
);

-- ==================== PEDIDOS ====================

CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    address_id UUID REFERENCES addresses(id),
    status order_status DEFAULT 'PENDING',
    total DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL -- Precio al momento de la compra
);

-- ==================== CHAT / CONVERSACIONES ====================

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- "user", "assistant", "system"
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ÍNDICES ====================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_available ON products(available);
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE INDEX idx_vehicles_user ON vehicles(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_vehicle_compatibility_product ON vehicle_compatibility(product_id);
