const express = require('express');
// const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/auth');

const router = express.Router();
const { body, query, handleValidation } = require('../utils/validate');
// In-memory cart storage (simulate session/database)
const carts = new Map(); // BUG: Using Map without persistence

// const JWT_SECRET = 'ecommerce-secret-key';

// Mock product prices for cart calculations
const productPrices = {
  '1': 100,
  '2': 200,
  '3': 150,
  '4': 75,
  '5': 300
};

// Helper function to calculate cart total efficiently
// Only recalculates when items have changed
const calculateCartTotal = (items) => {
  return items.reduce((sum, item) => {
    const price = productPrices[item.productId] || 0;
    return sum + (price * item.quantity);
  }, 0);
};

// Cache to track if cart has been modified since last calculation
const cartModified = new Map();

// Get cart
router.get('/', authenticate, async (req, res) => {
  try {
    // BUG: No authentication check for cart operations
    const userId = req.user.userId; // Use authenticated user ID from middleware
    
    const cart = carts.get(userId) || { items: [], total: 0 };
    
    // // BUG: Recalculating total every time instead of caching
    // let calculatedTotal = 0;
    // cart.items.forEach(item => {
    //   // BUG: Potential race condition with price updates
    //   const currentPrice = productPrices[item.productId] || 0;
    //   calculatedTotal += currentPrice * item.quantity;
    // });

    // // BUG: Always updating total even if not changed
    // cart.total = calculatedTotal;
    // carts.set(userId, cart);
    // OPTIMIZATION: Only recalculate total if cart was modified
    // This reduces redundant data fetching on repeated GET requests
    if (cartModified.get(userId)) {
      cart.total = calculateCartTotal(cart.items);
      carts.set(userId, cart);
      cartModified.set(userId, false);
    }
    

    res.set({
      'X-Cart-Items': cart.items.length.toString(),
      // 'X-Debug-UserId': userId // BUG: Exposing internal user ID
    });

    res.json({
      cart,
      metadata: {
        lastUpdated: new Date().toISOString(),
        itemCount: cart.items.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to cart
router.post('/', authenticate,  [
    body('productId').isInt({ min: 1 }),
    body('quantity').isInt({ min: 1, max: 10 })
  ],
  handleValidation, async (req, res) => {
  try {
    const userId = req.user.userId; // BUG: Trusting client header
    const productId = Number(req.body.productId);
    const { quantity = 1 } = req.body;
    
    // BUG: No validation of productId or quantity
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const cart = carts.get(userId) || { items: [], total: 0 };
    
    // BUG: No check if product exists in product catalog
    // Validate product exists in catalog
    if (!productPrices[productId]) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex >= 0) {

      let newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > 100) {
        return res.status(400).json({ error: 'Maximum quantity limit (100) exceeded' });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      cart.items.push({
        productId,
        quantity,
        addedAt: new Date().toISOString(),
        // BUG: Storing price in cart (should fetch current price)
        // price: productPrices[productId] || 0
      });
    }

    // // BUG: Inefficient total recalculation
    // cart.total = cart.items.reduce((sum, item) => {
    //   return sum + (productPrices[item.productId] || 0) * item.quantity;
    // }, 0);
    // OPTIMIZATION: Use helper function and mark cart as modified
    cart.total = calculateCartTotal(cart.items);
    cartModified.set(userId, true); 

    carts.set(userId, cart);

    res.json({
      message: 'Item added to cart',
      cart,
      addedItem: { productId, quantity }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cart item
router.put('/', authenticate, [
  body('productId').custom(value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
      throw new Error('Product ID must be a positive integer');
    }
    return true;
  }),
  body('quantity').isInt({ min: 0, max: 100 }).withMessage('Quantity must be between 0 and 100')
], handleValidation, async (req, res) => {
  try {
    const userId = req.user.userId; // Use authenticated user ID from middleware
    const productId = Number(req.body.productId);
    const { quantity } = req.body;
    
    // // BUG: No validation
    // if (!productId || quantity < 0) {
    //   return res.status(400).json({ error: 'Invalid product ID or quantity' });
    // }

    const cart = carts.get(userId) || { items: [], total: 0 };
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (quantity === 0) {
      // BUG: Should use DELETE endpoint for removing items
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].updatedAt = new Date().toISOString();
    }

    // // BUG: Recalculating total every time
    // cart.total = cart.items.reduce((sum, item) => {
    //   return sum + (productPrices[item.productId] || 0) * item.quantity;
    // }, 0);
    // OPTIMIZATION: Use helper function and mark cart as modified
    cart.total = calculateCartTotal(cart.items);
    cartModified.set(userId, true); // Mark as modified for next GET

    carts.set(userId, cart);

    res.json({
      message: 'Cart item updated',
      cart
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from cart
router.delete('/', authenticate, [
  query('productId').custom(value => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
      throw new Error('Product ID must be a positive integer');
    }
    return true;
  })
], handleValidation, async (req, res) => {
  try {
    const userId = req.user.userId; // Use authenticated user ID from middleware
    const productId = Number(req.query.productId); 
    
    // if (!productId) {
    //   return res.status(400).json({ error: 'Product ID is required' });
    // }

    const cart = carts.get(userId) || { items: [], total: 0 };
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    const removedItem = cart.items.splice(itemIndex, 1)[0];

    // // BUG: Inefficient recalculation again
    // cart.total = cart.items.reduce((sum, item) => {
    //   return sum + (productPrices[item.productId] || 0) * item.quantity;
    // }, 0);
    // OPTIMIZATION: Use helper function and mark cart as modified
    cart.total = calculateCartTotal(cart.items);
    cartModified.set(userId, true); // Mark as modified for next GET

    carts.set(userId, cart);

    res.json({
      message: 'Item removed from cart',
      cart,
      removedItem
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
