import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

function buildWorkbook(sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  ws.columns = columns.map(({ header, key, width }) => ({
    header,
    key,
    width: width || 20,
  }));

  ws.addRows(rows);

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF0F0F0' },
  };

  return wb;
}

async function sendExcel(res, wb, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );
  await wb.xlsx.write(res);
  res.end();
}

const PRODUCT_COLUMNS = [
  { header: 'id', key: 'id', width: 36 },
  { header: 'name', key: 'name', width: 40 },
  { header: 'brand_id', key: 'brand_id', width: 20 },
  { header: 'brand_name', key: 'brand_name', width: 20 },
  { header: 'category_id', key: 'category_id', width: 20 },
  { header: 'category_name', key: 'category_name', width: 20 },
  { header: 'price', key: 'price', width: 14 },
  { header: 'discount_percent', key: 'discount_percent', width: 14 },
  { header: 'available', key: 'available', width: 12 },
  { header: 'total_stock', key: 'total_stock', width: 12 },
  { header: 'image', key: 'image', width: 50 },
  { header: 'description', key: 'description', width: 60 },
];

router.get('/products', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, b.name as brand_name, c.name as category_name,
             COALESCE(SUM(i.stock), 0) as total_stock
      FROM products p
      JOIN brands b ON p.brand_id = b.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY p.id, b.name, c.name
      ORDER BY p.name ASC
    `);

    const rows = result.rows.map((p) => ({
      id: p.id,
      name: p.name,
      brand_id: p.brand_id,
      brand_name: p.brand_name,
      category_id: p.category_id,
      category_name: p.category_name,
      price: Number(p.price),
      discount_percent: Number(p.discount_percent),
      available: p.available,
      total_stock: Number(p.total_stock),
      image: p.image || '',
      description: p.description || '',
    }));

    const wb = buildWorkbook('Productos', PRODUCT_COLUMNS, rows);
    await sendExcel(res, wb, 'productos.xlsx');
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ error: 'Error al exportar productos' });
  }
});

const ORDER_COLUMNS = [
  { header: 'ID', key: 'id', width: 36 },
  { header: 'Usuario', key: 'userName', width: 24 },
  { header: 'Email', key: 'userEmail', width: 30 },
  { header: 'Teléfono', key: 'userPhone', width: 16 },
  { header: 'Estado', key: 'status', width: 14 },
  { header: 'Total', key: 'total', width: 14 },
  { header: 'Costo Envío', key: 'shippingCost', width: 14 },
  { header: 'Desc. Puntos', key: 'pointsDiscount', width: 14 },
  { header: 'Notas', key: 'notes', width: 40 },
  { header: 'Creado', key: 'createdAt', width: 20 },
  { header: 'Actualizado', key: 'updatedAt', width: 20 },
];

router.get('/orders', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, u.name as user_name, u.email as user_email, u.phone as user_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    const rows = result.rows.map((o) => ({
      id: o.id,
      userName: o.user_name || '',
      userEmail: o.user_email || '',
      userPhone: o.user_phone || '',
      status: o.status,
      total: Number(o.total),
      shippingCost: Number(o.shipping_cost || 0),
      pointsDiscount: Number(o.points_discount || 0),
      notes: o.notes || '',
      createdAt: o.created_at?.toISOString(),
      updatedAt: o.updated_at?.toISOString(),
    }));

    const wb = buildWorkbook('Pedidos', ORDER_COLUMNS, rows);
    await sendExcel(res, wb, 'pedidos.xlsx');
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({ error: 'Error al exportar pedidos' });
  }
});

const USER_COLUMNS = [
  { header: 'ID', key: 'id', width: 36 },
  { header: 'Nombre', key: 'name', width: 24 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Teléfono', key: 'phone', width: 16 },
  { header: 'Rol', key: 'role', width: 12 },
  { header: 'Puntos', key: 'points', width: 10 },
  { header: 'Creado', key: 'createdAt', width: 20 },
  { header: 'Actualizado', key: 'updatedAt', width: 20 },
];

router.get('/users', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY name ASC');
    const rows = result.rows.map((u) => ({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role,
      points: Number(u.points || 0),
      createdAt: u.created_at?.toISOString(),
      updatedAt: u.updated_at?.toISOString(),
    }));

    const wb = buildWorkbook('Usuarios', USER_COLUMNS, rows);
    await sendExcel(res, wb, 'usuarios.xlsx');
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ error: 'Error al exportar usuarios' });
  }
});

const CATEGORY_COLUMNS = [
  { header: 'ID', key: 'id', width: 20 },
  { header: 'Nombre', key: 'name', width: 24 },
  { header: 'Icono', key: 'icon', width: 20 },
];

router.get('/categories', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    const rows = result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || '',
    }));

    const wb = buildWorkbook('Categorías', CATEGORY_COLUMNS, rows);
    await sendExcel(res, wb, 'categorias.xlsx');
  } catch (error) {
    console.error('Error exporting categories:', error);
    res.status(500).json({ error: 'Error al exportar categorías' });
  }
});

const BRAND_COLUMNS = [
  { header: 'ID', key: 'id', width: 20 },
  { header: 'Nombre', key: 'name', width: 24 },
  { header: 'Logo', key: 'logo', width: 50 },
];

router.get('/brands', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name ASC');
    const rows = result.rows.map((b) => ({
      id: b.id,
      name: b.name,
      logo: b.logo || '',
    }));

    const wb = buildWorkbook('Marcas', BRAND_COLUMNS, rows);
    await sendExcel(res, wb, 'marcas.xlsx');
  } catch (error) {
    console.error('Error exporting brands:', error);
    res.status(500).json({ error: 'Error al exportar marcas' });
  }
});

const INVENTORY_COLUMNS = [
  { header: 'Producto ID', key: 'productId', width: 36 },
  { header: 'Producto', key: 'productName', width: 40 },
  { header: 'Almacén ID', key: 'warehouseId', width: 36 },
  { header: 'Almacén', key: 'warehouseName', width: 24 },
  { header: 'Stock', key: 'stock', width: 10 },
];

router.get('/inventory', authenticate, authorize('ADMIN', 'SUPPORT'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.product_id, p.name as product_name,
             i.warehouse_id, w.name as warehouse_name, i.stock
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN warehouses w ON i.warehouse_id = w.id
      ORDER BY p.name ASC, w.name ASC
    `);

    const rows = result.rows.map((inv) => ({
      productId: inv.product_id,
      productName: inv.product_name,
      warehouseId: inv.warehouse_id,
      warehouseName: inv.warehouse_name,
      stock: inv.stock,
    }));

    const wb = buildWorkbook('Inventario', INVENTORY_COLUMNS, rows);
    await sendExcel(res, wb, 'inventario.xlsx');
  } catch (error) {
    console.error('Error exporting inventory:', error);
    res.status(500).json({ error: 'Error al exportar inventario' });
  }
});

export default router;
