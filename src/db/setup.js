import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from './pool.js';

async function setup() {
  console.log('🗄️  Setting up Volta database...');
  
  try {
    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database tables created successfully!');
    console.log('📊 Tables: users, addresses, vehicles, categories, brands, products, vehicle_compatibility, orders, order_items, chat_sessions, chat_messages');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setup();
