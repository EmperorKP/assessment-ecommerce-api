# 🛒 Assessment 2: E-commerce Product API

Welcome to the E-commerce Product API assessment! This project simulates a real-world e-commerce backend with **critical performance issues** and **security vulnerabilities** that you need to identify and fix.

## 🎯 Objective

Your mission is to:
1. **🐛 Fix performance bottlenecks** that make the API slow
2. **🔒 Patch security vulnerabilities** that expose sensitive data
3. **⚡ Implement missing features** for a complete e-commerce experience
4. **🧩 Solve hidden puzzles** throughout the application

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Netlify CLI (for local development)

### Installation

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:8888`

## 📚 API Documentation

### Product Management

#### GET /api/products
Get paginated list of products with search and filtering
```bash
# Basic usage
curl "http://localhost:8888/api/products"

# With pagination and search
curl "http://localhost:8888/api/products?page=1&limit=10&search=electronics&category=Electronics"

# Try the admin parameter (security issue!)
curl "http://localhost:8888/api/products?admin=true"
```

#### GET /api/products/:id
Get single product by ID
```bash
curl "http://localhost:8888/api/products/1"

# Try internal parameter (security issue!)
curl "http://localhost:8888/api/products/1?internal=yes"
```

#### POST /api/products
Create new product
```bash
curl -X POST "http://localhost:8888/api/products" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Product","price":99.99,"category":"Electronics"}'
```

### Cart Management

#### GET /api/cart
Get user's cart
```bash
curl "http://localhost:8888/api/cart" \
  -H "X-User-Id: user123"
```

#### POST /api/cart
Add item to cart
```bash
curl -X POST "http://localhost:8888/api/cart" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{"productId":"1","quantity":2}'
```

## 🐛 Critical Performance Issues

### Major Performance Problems
1. **Product Generation Bug** - 1000 products are generated on EVERY request
2. **Inefficient Search** - Linear search through entire product array  
3. **Memory Leaks** - No cleanup of generated data
4. **Inefficient Sorting** - Re-sorting entire arrays unnecessarily
5. **No Caching** - API responses aren't cached
6. **Excessive Data Transfer** - Returning too much data per request

### Cart Performance Issues
7. **Inefficient Total Calculation** - Recalculating cart total every operation
8. **No Data Persistence** - Using in-memory Map that doesn't persist
9. **Price Lookup Inefficiency** - Fetching prices individually for each calculation
10. **No Batch Operations** - Can't update multiple cart items at once

## 🔒 Critical Security Vulnerabilities

### Data Exposure Issues
1. **Internal Data Leakage** - Cost prices and supplier info exposed via query params
2. **Admin Data Exposure** - `?admin=true` reveals sensitive internal data
3. **Password/Token Hardcoding** - JWT secrets are hardcoded
4. **Error Information Disclosure** - Stack traces and error details exposed
5. **No Authentication** - Critical operations (create/update/delete) have no auth

### Input Security Issues  
6. **No Input Validation** - Malicious data can be inserted
7. **SQL Injection Simulation** - Product IDs not properly sanitized
8. **Client-Controlled Data** - Trusting X-User-Id header from client
9. **No Rate Limiting** - API vulnerable to abuse
10. **Cross-User Data Access** - Users can access other users' cart data

## ⚡ Features to Implement

### Must-Have Features
1. **Authentication Middleware** - Proper JWT-based authentication
2. **Product Caching System** - Cache frequently accessed products
3. **Search Optimization** - Implement proper search indexing
4. **Cart Persistence** - Proper database/storage for cart data
5. **Input Validation** - Comprehensive validation for all endpoints
6. **Error Handling** - Proper error responses without data leakage

### Nice-to-Have Features
7. **Product Categories API** - Separate endpoint for managing categories
8. **Inventory Management** - Track and update product stock levels
9. **Order Management** - Convert carts to orders
10. **Product Reviews** - Rating and review system for products
11. **Wishlist Functionality** - Save products for later
12. **Bulk Operations** - Batch create/update products

## 🧩 Puzzles & Hidden Challenges

### Puzzle 1: Base64 Header Decoder 🔍
Find the Base64 encoded message in the API response headers and decode it.
- **Hint**: Check the `X-Puzzle-Hint` header
- **Location**: `/api/products` response headers
- **Challenge**: What endpoint does it reveal?
- **Answer**: Decode `cHJvZHVjdF9zZWNyZXRfZW5kcG9pbnQ=` to reveal `product_secret_endpoint`

### Puzzle 2: Secret Product Endpoint 🕵️
Find and access the hidden endpoint for secret product data.
- **Multiple Access Methods**: 
  - Authorization header: `Bearer secret-admin-token`
  - API Key header: `admin-api-key-2024`  
  - Query parameter: `?secret=profit-data`
- **Reward**: Access to internal profit margins and cost data
- **Answer**: Use any of the three authentication methods with the `/api/product_secret_endpoint` discovered in Puzzle 1

### Puzzle 3: ROT13 Cipher 🔐
Decode the ROT13 encrypted message from the secret endpoint.
- **Tool Needed**: ROT13 decoder
- **Message Location**: `finalPuzzle` field in secret endpoint response
- **Final Clue**: Points to next challenge location
- **Answer**: Decode `Pbatenghyngvbaf! Lbh sbhaq gur frperg cebqhpg qngn. Svany pyhrf: PURPX_NQZVA_CNARY_2024` which translates to "Congratulations! You found the secret product data. Final clues: CHECK_ADMIN_PANEL_2024"

### Puzzle 4: Hash Challenge 🧮
The secret endpoint returns a time-based MD5 hash.
- **Challenge**: Understand how it's generated
- **Use Case**: Could be used for cache invalidation or security
- **Hash Pattern**: MD5 hash changes based on timestamp
- **Tool Needed**: MD5 hash analyzer or reverse engineering
- **Answer**: The hash is generated using `md5(timestamp + secret_key)` where the secret key can be found by analyzing the hash generation pattern or by examining the source code. The hash serves as a time-based token for secure endpoint access.

## 🔧 Testing Your Solutions

### Performance Testing
```bash
# Test product generation performance
time curl "http://localhost:8888/api/products"

# Test search performance with common terms
time curl "http://localhost:8888/api/products?search=product"

# Test large result sets
time curl "http://localhost:8888/api/products?limit=1000"
```

### Security Testing
```bash
# Test admin data exposure
curl "http://localhost:8888/api/products?admin=true"

# Test internal data access
curl "http://localhost:8888/api/products/1?internal=yes"

# Test malicious product ID
curl "http://localhost:8888/api/products/<script>alert('xss')</script>"

# Test secret endpoint access methods
curl -H "Authorization: Bearer secret-admin-token" \
     "http://localhost:8888/api/product_secret_endpoint"
```

### Cart Security Testing
```bash
# Test cross-user data access
curl -H "X-User-Id: victim" "http://localhost:8888/api/cart"
curl -H "X-User-Id: attacker" "http://localhost:8888/api/cart"
```

## 📝 Expected Solutions

### Performance Optimizations
1. **Implement Product Caching** - Generate products once, cache results
2. **Add Search Indexing** - Use proper data structures for fast search
3. **Optimize Database Queries** - Reduce redundant data fetching
4. **Implement Response Caching** - Cache API responses for identical requests
5. **Add Pagination Limits** - Enforce reasonable page sizes

### Security Fixes
1. **Remove Debug Parameters** - Eliminate `?admin=true` and `?internal=yes`
2. **Add Authentication** - Protect all write operations
3. **Input Sanitization** - Validate and sanitize all user inputs
4. **Secure Error Handling** - Remove stack traces from responses
5. **Implement RBAC** - Role-based access control for admin operations

### Feature Implementations
1. **JWT Middleware** - Proper token validation
2. **User Context** - Secure user identification
3. **Data Validation** - Comprehensive input validation
4. **Audit Logging** - Track API usage and changes

## 🏆 Bonus Challenges

### Advanced Security
- **Rate Limiting** - Implement API rate limiting
- **CORS Configuration** - Proper CORS settings
- **SQL Injection Prevention** - Even though using in-memory data
- **XSS Prevention** - Sanitize all user inputs

### Advanced Performance
- **Database Optimization** - If implementing real database
- **CDN Integration** - For product images and static content
- **Load Balancing** - Handle multiple concurrent users
- **Metrics Collection** - Track API performance metrics

### Advanced Features
- **Real-time Inventory** - WebSocket updates for stock changes
- **Recommendation Engine** - Suggest related products
- **Advanced Search** - Fuzzy search, filters, faceted search
- **Export Functionality** - Export product catalogs

## 🚨 Common Pitfalls

1. **Don't just hide vulnerabilities** - Actually fix the root cause
2. **Performance fixes should be measurable** - Use timing before/after
3. **Maintain API compatibility** - Don't break existing functionality
4. **Test edge cases** - Empty results, invalid inputs, etc.
5. **Security by design** - Don't add security as an afterthought

## 📊 Evaluation Criteria

### Code Quality (25%)
- Clean, readable code
- Proper error handling
- Modern JavaScript features

### Security (25%)
- All vulnerabilities properly fixed
- No new security issues introduced
- Proper authentication implementation

### Performance (25%)
- Measurable performance improvements
- Efficient algorithms and data structures
- Proper caching implementation

### Feature Completeness (25%)
- All required features implemented
- Good user experience
- Comprehensive testing

## 📞 Support

Document any assumptions you make and challenges you face. This helps us understand your problem-solving approach.

**Good luck! May your code be performant and secure! 🚀**

