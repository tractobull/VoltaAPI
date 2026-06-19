# VoltaAPI

Backend API for Volta truck parts application.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **AI:** Groq API (Llama 3.1 8B Instant)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Edit `.env` file with your database credentials:

```env
DATABASE_URL="postgresql://volta:250755@localhost:5432/volta"
GROQ_API_KEY="gsk_your_api_key_here"
```

### 3. Setup database

```bash
npm run db:setup
```

### 4. Seed initial data

```bash
npm run db:seed
```

### 5. Start development server

```bash
npm run dev
```

API will be running at `http://localhost:3000`

## API Endpoints

### Products
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Chat
- `POST /api/chat` - Send message to AI
- `GET /api/chat/:sessionId` - Get chat history
- `DELETE /api/chat/:sessionId` - Delete chat session

### Users
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category

### Brands
- `GET /api/brands` - List all brands
- `POST /api/brands` - Create brand

### Health Check
- `GET /health` - Check API status

## Database Schema

- `users` - User accounts
- `addresses` - User addresses
- `vehicles` - User vehicles
- `categories` - Product categories
- `brands` - Product brands
- `products` - Products
- `vehicle_compatibility` - Product vehicle compatibility
- `orders` - User orders
- `order_items` - Order items
- `chat_sessions` - Chat sessions
- `chat_messages` - Chat messages
# VoltaAPI
