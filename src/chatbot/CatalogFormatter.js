export class CatalogFormatter {
  static format(products) {
    if (!products || products.length === 0) {
      return 'No se encontraron productos relevantes en el catálogo.';
    }
    return products.map(p => {
      const price = p.discountedPrice || p.price;
      return `${p.id}|${p.name}|$${price}|${p.stock > 0 ? `${p.stock} unidades` : 'Sin stock'}`;
    }).join('\n');
  }
}
