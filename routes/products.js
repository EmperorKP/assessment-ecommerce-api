const express = require('express');
const _ = require('lodash');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { query, param, body, handleValidation, isValidProductId, isSafeString } = require('../utils/validate');

const router = express.Router();

// Large product dataset to demonstrate performance issues
const products = [];

// Search indices for fast lookups
const searchIndices = {
  // Inverted index: word -> Set of product IDs
  invertedIndex: new Map(),
  // Category index: category -> Set of product IDs
  categoryIndex: new Map(),
  // Brand index: brand -> Set of product IDs
  brandIndex: new Map(),
  // Product map for O(1) lookups: id -> product
  productMap: new Map()
};

// Build search indices from products
function buildSearchIndices() {
  // Clear existing indices
  searchIndices.invertedIndex.clear();
  searchIndices.categoryIndex.clear();
  searchIndices.brandIndex.clear();
  searchIndices.productMap.clear();

  products.forEach(product => {
    // Add to product map for fast ID lookup
    searchIndices.productMap.set(product.id, product);

    // Build inverted index for text search
    const textContent = `${product.name} ${product.description}`.toLowerCase();
    const words = textContent.split(/\s+/).filter(word => word.length > 2);
    
    words.forEach(word => {
      if (!searchIndices.invertedIndex.has(word)) {
        searchIndices.invertedIndex.set(word, new Set());
      }
      searchIndices.invertedIndex.get(word).add(product.id);
    });

    // Build category index
    if (product.category) {
      if (!searchIndices.categoryIndex.has(product.category)) {
        searchIndices.categoryIndex.set(product.category, new Set());
      }
      searchIndices.categoryIndex.get(product.category).add(product.id);
    }

    // Build brand index
    if (product.brand) {
      if (!searchIndices.brandIndex.has(product.brand)) {
        searchIndices.brandIndex.set(product.brand, new Set());
      }
      searchIndices.brandIndex.get(product.brand).add(product.id);
    }
  });
}

// Fast search using indices
function searchProducts(searchTerm) {
  if (!searchTerm) return new Set(products.map(p => p.id));

  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  
  if (searchWords.length === 0) return new Set(products.map(p => p.id));

  // Find products that match ALL search words (AND operation)
  let resultIds = null;
  
  searchWords.forEach(word => {
    const matchingIds = new Set();
    
    // Find all words in index that contain the search word (prefix/partial match)
    for (const [indexWord, productIds] of searchIndices.invertedIndex.entries()) {
      if (indexWord.includes(word)) {
        productIds.forEach(id => matchingIds.add(id));
      }
    }
    
    // Intersect with previous results (AND operation)
    if (resultIds === null) {
      resultIds = matchingIds;
    } else {
      resultIds = new Set([...resultIds].filter(id => matchingIds.has(id)));
    }
  });

  return resultIds || new Set();
}

// Generate sample products (performance issue - doing this on every request)
function generateProducts() {
  if (products.length > 0) return;

  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Beauty'];
  const brands = ['BrandA', 'BrandB', 'BrandC', 'BrandD', 'BrandE'];
  
  for (let i = 1; i <= 1000; i++) { // BUG: Generating 1000 products every time
    products.push({
      id: i.toString(),
      name: `Product ${i}`,
      description: `This is product number ${i} with amazing features`,
      price: Math.floor(Math.random() * 1000) + 10,
      category: categories[Math.floor(Math.random() * categories.length)],
      brand: brands[Math.floor(Math.random() * brands.length)],
      stock: Math.floor(Math.random() * 100),
      rating: (Math.random() * 5).toFixed(1),
      tags: [`tag${i}`, `feature${i % 10}`],
      createdAt: new Date().toISOString(),
      // BUG: Sensitive internal data exposed
      costPrice: Math.floor(Math.random() * 500) + 5,
      supplier: `Supplier ${i % 20}`,
      internalNotes: `Internal notes for product ${i}`,
      adminOnly: Math.random() > 0.9
    });
  }
}

// generate once at startup
generateProducts();
// Build search indices
buildSearchIndices();

// const JWT_SECRET = 'ecommerce-secret-key'; // BUG: Hardcoded secret

// Middleware to ensure products are generated
// router.use((req, res, next) => {
//   // BUG: Regenerating products on every request (major performance issue)
//   if (products.length === 0) {
//     generateProducts();
//   }
//   next();
// });

// Get all products
router.get('/', [
  query('page').optional().isInt({ min: 1, max: 10000 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().isLength({ max: 200 }).custom(isSafeString).withMessage('Invalid search query'),
  query('category').optional().isString().isLength({ max: 50 }).custom(isSafeString).withMessage('Invalid category'),
  query('sortBy').optional().isIn(['name', 'price', 'rating', 'createdAt', 'stock']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('admin').isEmpty().withMessage('Unauthorized parameter'),
  query('internal').isEmpty().withMessage('Unauthorized parameter')
], handleValidation, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // BUG: Default limit too high
    const search = req.query.search;
    const category = req.query.category;
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';

    // let filteredProducts = products; // BUG: Not efficient, copying entire array
    // Use search indices for fast filtering
    let filteredProductIds = null;
    
    // BUG: Inefficient search - linear search through all products
    if (search) {
      // filteredProducts = filteredProducts.filter(p => 
      //   p.name.toLowerCase().includes(search) ||
      //   p.description.toLowerCase().includes(search)
      // );
      filteredProductIds = searchProducts(search);
    }

    if (category) {
      const categoryIds = searchIndices.categoryIndex.get(category) || new Set();
      if (filteredProductIds === null) {
        filteredProductIds = categoryIds;
      } else {
        // Intersect with search results
        filteredProductIds = new Set([...filteredProductIds].filter(id => categoryIds.has(id)));
      }
    }

    // Get final filtered products
    let filteredProducts = filteredProductIds === null
      ? products
      : [...filteredProductIds].map(id => searchIndices.productMap.get(id)).filter(Boolean);

    // BUG: Inefficient sorting
    filteredProducts = _.orderBy(filteredProducts, [sortBy], [sortOrder]);

    // BUG: No pagination validation
    const startIndex = (page - 1) * limit;
    if (startIndex >= filteredProducts.length && filteredProducts.length > 0) {
      return res.status(400).json({ error: 'Page number exceeds available pages' });
    }
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

    res.set({
      'X-Total-Count': filteredProducts.length.toString(),
      'X-Performance-Warning': 'This endpoint is slow, needs optimization', // HINT
      'X-Secret-Query': 'try ?admin=true'
    });

    res.json({
      products: paginatedProducts.map(product => {
        // BUG: Conditionally exposing admin data based on query param (security issue)
        // if (req.query.admin === 'true') {
        //   return product; // Exposing all internal data
        // }
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          category: product.category,
          brand: product.brand,
          stock: product.stock,
          rating: product.rating,
          tags: product.tags
        };
      }),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredProducts.length / limit),
        totalItems: filteredProducts.length,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    // BUG: Exposing internal error details
    res.status(500).json({ 
      error: 'Internal server error',
      // details: error.message, // BUG: Exposing error details
      // stack: error.stack // BUG: Exposing stack trace
    });
  }
});

// Get product by ID
router.get('/:productId', [
  param('productId').custom(isValidProductId).withMessage('Invalid product ID format'),
  query('internal').isEmpty().withMessage('Unauthorized parameter')
], handleValidation, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // // BUG: No input validation - could cause issues with malicious input
    // const product = products.find(p => p.id === productId);
    const product = searchIndices.productMap.get(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // // BUG: SQL injection-like vulnerability simulation
    // if (productId.includes('<script>') || productId.includes('DROP')) {
    //   // BUG: Still processing the request instead of rejecting it
    //   console.log('Potential attack detected:', productId);
    // }

    // BUG: Exposing internal data based on query parameter
    // const includeInternal = req.query.internal === 'yes';
    
    // const responseData = includeInternal ? product : {
    const responseData = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      brand: product.brand,
      stock: product.stock,
      rating: product.rating,
      tags: product.tags,
      createdAt: product.createdAt
    };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      // details: error.message
    });
  }
});

// Create product
router.post('/', authenticate, authorize(['admin']), [
  body('name').isString().trim().isLength({ min: 1, max: 200 }).custom(isSafeString).withMessage('Invalid product name'),
  body('description').isString().trim().isLength({ min: 1, max: 1000 }).custom(isSafeString).withMessage('Invalid description'),
  body('price').isFloat({ min: 0.01, max: 1000000 }).withMessage('Price must be a positive number'),
  body('category').isString().trim().isLength({ min: 1, max: 50 }).custom(isSafeString).withMessage('Invalid category'),
  body('brand').optional().isString().trim().isLength({ max: 100 }).custom(isSafeString).withMessage('Invalid brand'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Tags must be an array with max 10 items'),
  body('tags.*').optional().isString().isLength({ max: 50 }).custom(isSafeString).withMessage('Invalid tag'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be non-negative'),
  body('supplier').optional().isString().isLength({ max: 100 }).custom(isSafeString).withMessage('Invalid supplier'),
  body('internalNotes').optional().isString().isLength({ max: 500 }).custom(isSafeString).withMessage('Invalid internal notes'),
  body('adminOnly').optional().isBoolean().withMessage('adminOnly must be a boolean')
], handleValidation, async (req, res) => {
  try {
    const productData = req.body;
    
    const newId = (Math.max(...products.map(p => parseInt(p.id))) + 1).toString();
    
    const newProduct = {
      id: newId,
      name: productData.name,
      description: productData.description,
      price: productData.price, // BUG: No validation for positive numbers
      category: productData.category,
      brand: productData.brand,
      stock: productData.stock || 0,
      rating: 0,
      tags: productData.tags || [],
      createdAt: new Date().toISOString(),
      // BUG: Adding internal fields without validation
      costPrice: productData.costPrice || productData.price * 0.7,
      supplier: productData.supplier || 'Unknown',
      internalNotes: productData.internalNotes || '',
      adminOnly: productData.adminOnly || false
    };

    products.push(newProduct);

    res.status(201).json({
      message: 'Product created successfully',
      // product: newProduct // BUG: Returning all internal data
      product: {
        id: newProduct.id,
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        category: newProduct.category,
        brand: newProduct.brand,
        stock: newProduct.stock,
        rating: newProduct.rating,
        tags: newProduct.tags,
        createdAt: newProduct.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      // details: error.message
    });
  }
});

// Update product
router.put('/:productId', authenticate, authorize(['admin']), [
  param('productId').custom(isValidProductId).withMessage('Invalid product ID format'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 200 }).custom(isSafeString).withMessage('Invalid product name'),
  body('description').optional().isString().trim().isLength({ min: 1, max: 1000 }).custom(isSafeString).withMessage('Invalid description'),
  body('price').optional().isFloat({ min: 0.01, max: 1000000 }).withMessage('Price must be a positive number'),
  body('category').optional().isString().trim().isLength({ min: 1, max: 50 }).custom(isSafeString).withMessage('Invalid category'),
  body('brand').optional().isString().trim().isLength({ max: 100 }).custom(isSafeString).withMessage('Invalid brand'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Tags must be an array with max 10 items'),
  body('tags.*').optional().isString().isLength({ max: 50 }).custom(isSafeString).withMessage('Invalid tag'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be non-negative'),
  body('supplier').optional().isString().isLength({ max: 100 }).custom(isSafeString).withMessage('Invalid supplier'),
  body('internalNotes').optional().isString().isLength({ max: 500 }).custom(isSafeString).withMessage('Invalid internal notes'),
  body('adminOnly').optional().isBoolean().withMessage('adminOnly must be a boolean'),
  body('id').isEmpty().withMessage('Cannot update product ID'),
  body('createdAt').isEmpty().withMessage('Cannot update creation date')
], handleValidation, async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;
    
    // BUG: No authentication check
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // BUG: No validation of update data
    // BUG: Allowing arbitrary field updates
    const allowedFields = ['name', 'description', 'price', 'category', 'brand', 'stock', 'tags', 'costPrice', 'supplier', 'internalNotes', 'adminOnly'];
    const sanitizedUpdate = {};
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        sanitizedUpdate[field] = updateData[field];
      }
    });
    
    products[productIndex] = { ...products[productIndex], ...sanitizedUpdate };

    res.json({
      message: 'Product updated successfully',
      // product: products[productIndex] // BUG: Returning all data
        product: {
        id: products[productIndex].id,
        name: products[productIndex].name,
        description: products[productIndex].description,
        price: products[productIndex].price,
        category: products[productIndex].category,
        brand: products[productIndex].brand,
        stock: products[productIndex].stock,
        rating: products[productIndex].rating,
        tags: products[productIndex].tags,
        createdAt: products[productIndex].createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      // details: error.message
    });
  }
});

// Delete product
router.delete('/:productId', authenticate, authorize(['admin']), [
  param('productId').custom(isValidProductId).withMessage('Invalid product ID format')
], handleValidation, async (req, res) => {
  try {
    const { productId } = req.params;
    
    // BUG: No authentication check
    // BUG: No admin role check for deletion
    
    const productIndex = products.findIndex(p => p.id === productId);
    
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    products.splice(productIndex, 1);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      // details: error.message
    });
  }
});

module.exports = router;

