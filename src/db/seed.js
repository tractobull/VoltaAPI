import 'dotenv/config';
import pool from './pool.js';

const categories = [
  { id: 'engine', name: 'Motor', icon: 'settings' },
  { id: 'brakes', name: 'Frenos', icon: 'disc' },
  { id: 'suspension', name: 'Suspensión', icon: 'shield' },
  { id: 'transmission', name: 'Transmisión', icon: 'git-branch' },
  { id: 'electrical', name: 'Eléctrico', icon: 'zap' },
  { id: 'filters', name: 'Filtros', icon: 'droplet' },
];

const brands = [
  { id: 'meritor', name: 'Meritor', logo: 'M' },
  { id: 'fleetguard', name: 'Fleetguard', logo: 'F' },
  { id: 'delco', name: 'Delco Remy', logo: 'DR' },
  { id: 'wabco', name: 'WABCO', logo: 'W' },
  { id: 'bendix', name: 'Bendix', logo: 'B' },
  { id: 'eaton', name: 'Eaton', logo: 'E' },
  { id: 'cummins', name: 'Cummins', logo: 'C' },
  { id: 'borgwarner', name: 'BorgWarner', logo: 'BW' },
  { id: 'depo', name: 'Depo', logo: 'D' },
  { id: 'epcom', name: 'EPCOM', logo: 'EP' },
];

const products = [
  {
    name: 'Alternador 24V 100A',
    brandId: 'delco',
    categoryId: 'electrical',
    price: 1250,
    image: 'https://resources.apymsa.com.mx/imagenes/FotosSpeed/0164700/01647003a.jpg',
    available: true,
  },
  {
    name: 'Pastillas de freno',
    brandId: 'meritor',
    categoryId: 'brakes',
    price: 45,
    image: 'https://m.media-amazon.com/images/I/513ok64+jUL._AC_UF894,1000_QL80_.jpg',
    available: false,
  },
  {
    name: 'Filtro de aceite LF16015',
    brandId: 'fleetguard',
    categoryId: 'filters',
    price: 18.5,
    image: 'https://m.media-amazon.com/images/I/41naFSo3jCL._AC_UF894,1000_QL80_.jpg',
    available: true,
  },
  {
    name: 'Faro delantero izquierdo',
    brandId: 'depo',
    categoryId: 'electrical',
    price: 120,
    image: 'https://refaccionariamario.info/148404-large_default/faro-principal-cromado-liso-electrico-izquierdo-depo-para-derby-6n.jpg',
    available: true,
  },
  {
    name: 'Kit de suspensión neumática',
    brandId: 'wabco',
    categoryId: 'suspension',
    price: 850,
    image: 'https://cdn.autodoc.de/thumb?id=18386697&m=0&n=2&lng=es&rev=94078028',
    available: true,
  },
  {
    name: 'Block de motor 6 cilindros',
    brandId: 'cummins',
    categoryId: 'engine',
    price: 4500,
    image: 'https://m.media-amazon.com/images/I/41UAJ2715YL._AC_UF894,1000_QL80_.jpg',
    available: true,
  },
  {
    name: 'Turbo cargador T4',
    brandId: 'borgwarner',
    categoryId: 'engine',
    price: 2200,
    image: 'https://m.media-amazon.com/images/I/719a52fjAZL._AC_UF894,1000_QL80_.jpg',
    available: true,
  },
  {
    name: 'Kit de inyectores diésel',
    brandId: 'delco',
    categoryId: 'engine',
    price: 680,
    image: 'https://m.media-amazon.com/images/I/61bYvnseiKL._AC_UF894,1000_QL80_.jpg',
    available: true,
  },
  {
    name: 'Disco de embrague',
    brandId: 'eaton',
    categoryId: 'transmission',
    price: 320,
    image: 'https://www.eaton.com/mdmfiles/PDM24897970/IS-VG-EATONEVERTOUGHSELFADJUSTCLUTCH-C/500x500_72dpi',
    available: true,
  },
  {
    name: 'Aceite de caja 75W-90',
    brandId: 'eaton',
    categoryId: 'transmission',
    price: 45,
    image: 'https://www.eaton.com/content/dam/eaton/products/transmissions/lubricants/eaton-gear-lube-gallon-fe75w-90-rgb.jpg',
    available: true,
  },
  {
    name: 'Tambor de freno',
    brandId: 'bendix',
    categoryId: 'brakes',
    price: 175,
    image: 'https://m.media-amazon.com/images/I/61hnb8IVr-L.jpg',
    available: true,
  },
  {
    name: 'Manguera de freno reforzada',
    brandId: 'bendix',
    categoryId: 'brakes',
    price: 32,
    image: 'https://m.media-amazon.com/images/I/414ImvfUeaL._AC_UF894,1000_QL80_.jpg',
    available: true,
  },
  {
    name: 'Amortiguador neumático',
    brandId: 'wabco',
    categoryId: 'suspension',
    price: 290,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGHQUZEBwrRDOdi94GO9ckKwOiJl9IPdfbHQ&s',
    available: true,
  },
  {
    name: 'Filtro de aire CA1054',
    brandId: 'fleetguard',
    categoryId: 'filters',
    price: 42,
    image: 'https://m.media-amazon.com/images/I/61WX-h+rEHL.jpg',
    available: true,
  },
  {
    name: 'Filtro de combustible FF5052',
    brandId: 'fleetguard',
    categoryId: 'filters',
    price: 28,
    image: 'https://http2.mlstatic.com/D_NQ_NP_779447-MLM77494482826_072024-O.webp',
    available: true,
  },
  {
    name: 'Batería 12V 200Ah AGM',
    brandId: 'epcom',
    categoryId: 'electrical',
    price: 380,
    image: 'https://solartechmo.com.mx/wp/wp-content/uploads/2024/01/PL200D12V2-h1.png',
    available: true,
  },
  {
    name: 'Marcha de arranque 24V',
    brandId: 'delco',
    categoryId: 'electrical',
    price: 420,
    image: 'https://resources.apymsa.com.mx/imagenes/FotosSpeed/2800013/28000133a.jpg',
    available: true,
  },
];

async function seed() {
  console.log('🌱 Seeding Volta database...');
  
  try {
    // Insert categories
    console.log('📦 Inserting categories...');
    for (const cat of categories) {
      await pool.query(
        'INSERT INTO categories (id, name, icon) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [cat.id, cat.name, cat.icon]
      );
    }
    
    // Insert brands
    console.log('🏭 Inserting brands...');
    for (const brand of brands) {
      await pool.query(
        'INSERT INTO brands (id, name, logo) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [brand.id, brand.name, brand.logo]
      );
    }
    
    // Insert products
    console.log('📦 Inserting products...');
    for (const product of products) {
      await pool.query(
        `INSERT INTO products (name, brand_id, category_id, price, image, available) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [product.name, product.brandId, product.categoryId, product.price, product.image, product.available]
      );
    }
    
    console.log('✅ Seed completed successfully!');
    console.log(`   - ${categories.length} categories`);
    console.log(`   - ${brands.length} brands`);
    console.log(`   - ${products.length} products`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
