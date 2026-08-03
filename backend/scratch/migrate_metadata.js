const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/elister');
    const Product = require('./models/Product');
    const Listing = require('./models/Listing');
    
    function extractSizeAndColor(title, description) {
      let size = '';
      let color = '';
      if (!title) return { size, color };
      
      const sizeRegex = /\b(?:size|sz)\s*([0-9a-zA-Z\-]+)\b/i;
      const sizeMatch = title.match(sizeRegex) || (description && description.match(sizeRegex));
      if (sizeMatch) {
        size = sizeMatch[1];
      }
      
      const colors = ['pink', 'blue', 'green', 'black', 'white', 'red', 'yellow', 'purple', 'orange', 'grey', 'gray', 'brown', 'navy', 'olive', 'gold', 'silver', 'floral'];
      const words = title.toLowerCase().split(/[^a-zA-Z]/);
      const foundColor = colors.find(c => words.includes(c));
      if (foundColor) {
        color = foundColor.charAt(0).toUpperCase() + foundColor.slice(1);
      }
      
      return { size, color };
    }

    function extractBrand(title) {
      if (!title) return '';
      const commonBrands = ['nike', 'adidas', 'h&m', 'hm', 'under armour', 'abercrombie', 'levi\'s', 'levis', 'reebok', 'magicsuit', 'zara', 'gucci', 'prada', 'chanel', 'puma', 'champion'];
      const lowerTitle = title.toLowerCase();
      const found = commonBrands.find(b => lowerTitle.startsWith(b) || lowerTitle.includes(' ' + b));
      if (found) {
        return found.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      const firstWord = title.split(' ')[0];
      return firstWord || '';
    }

    const products = await Product.find({});
    console.log('Checking ' + products.length + ' products...');
    for (const p of products) {
      const { size, color } = extractSizeAndColor(p.title, p.description);
      const brand = extractBrand(p.title);
      
      let changed = false;
      if (!p.size && size) { p.size = size; changed = true; }
      if (!p.color && color) { p.color = color; changed = true; }
      if (!p.brand && brand) { p.brand = brand; changed = true; }
      
      if (p.source === 'ebay' && p.itemSpecifics) {
        const brandKey = Object.keys(p.itemSpecifics).find(k => k.toLowerCase() === 'brand');
        if (brandKey && p.itemSpecifics[brandKey] && p.itemSpecifics[brandKey].length > 0) {
          p.brand = p.itemSpecifics[brandKey][0];
          changed = true;
        }
      }
      
      if (changed) {
        await p.save();
        console.log('Updated: ' + p.title + ' -> Brand: ' + p.brand + ', Size: ' + p.size + ', Color: ' + p.color);
      }
    }

    const deletedListings = await Listing.deleteMany({ status: 'draft', sku: { $ne: '' } });
    console.log('Cleaned up ' + deletedListings.deletedCount + ' listings.');
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();
