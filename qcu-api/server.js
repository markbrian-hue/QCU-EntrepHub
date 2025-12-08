const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs'); 
const db = require('./db'); 

const app = express();
const PORT = 3000; 

// --- MIDDLEWARE ---
app.use(cors()); 
app.use(express.json()); 

// --- STATIC FILES (IMAGES) ---
// This allows the browser to see the images at http://localhost:3000/uploads/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists automatically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
    console.log("Created 'uploads' folder.");
}

// --- FILE UPLOAD CONFIG (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { 
        // Unique filename: timestamp-originalName
        cb(null, Date.now() + '-' + file.originalname); 
    }
});
const upload = multer({ storage: storage });

// --- SECURITY HELPER ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex').toLowerCase();
}

// ==========================================
// ROUTES
// ==========================================

// --- USERS ---

// --- USERS ---

// Register (Updated: No File Upload for Vendors)
// We use upload.none() because we are still sending FormData from frontend, but no actual files for register now
// --- USERS ---

// Register (Mixed Logic: File required for Buyer, Optional for Vendor)
app.post('/api/users/register', upload.single('idCardImage'), async (req, res) => {
    let { fullName, studentNumber, password, role, shopName, courseSection } = req.body;
    
    try {
        let idCardUrl = '';

        // --- VALIDATION LOGIC ---
        if (role === 'BUYER') {
            // BUYER: Must upload ID
            if (!req.file) {
                return res.status(400).json({ error: "Buyers must upload a School ID for verification." });
            }
            idCardUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        } 
        else if (role === 'VENDOR') {
            // VENDOR: No ID upload needed, but must have Shop Name
            if (!shopName) return res.status(400).json({ error: "Enterprise Name is required." });
            
            // Auto-fill Mapping
            fullName = shopName;
            studentNumber = shopName;
            courseSection = "N/A";
        }

        // Check if Account Exists
        const [existing] = await db.query('SELECT user_id FROM users WHERE student_number = ?', [studentNumber]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "This Student Number or Shop Name is already registered." });
        }

        const hashedPassword = hashPassword(password);
        
        // 1. Create User
        const [userResult] = await db.query(
            `INSERT INTO users (full_name, student_number, password_hash, role, id_card_image) VALUES (?, ?, ?, ?, ?)`,
            [fullName, studentNumber, hashedPassword, role, idCardUrl]
        );
        const newUserId = userResult.insertId;

        // 2. If Vendor, Create Vendor Profile
        if (role === 'VENDOR') {
            await db.query(
                `INSERT INTO vendors (user_id, shop_name, course_section, is_open, verification_status) VALUES (?, ?, ?, ?, 'PENDING')`,
                [newUserId, shopName, courseSection, 0]
            );
        }
        res.status(201).json({ message: 'User registered' });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// Login
app.post('/api/users/login', async (req, res) => {
    const { studentNumber, password } = req.body;
    try {
        const [users] = await db.query(`SELECT * FROM users WHERE student_number = ?`, [studentNumber]);
        if (users.length === 0) return res.status(401).send("Invalid Credentials");
        
        const user = users[0];
        const inputHash = hashPassword(password);
        if (user.password_hash !== inputHash) return res.status(401).send("Invalid Credentials");
        
        const [vendors] = await db.query(`SELECT * FROM vendors WHERE user_id = ?`, [user.user_id]);
        const vendor = vendors[0];

        // --- UPDATED RESPONSE ---
        res.json({
            UserId: user.user_id,
            fullName: user.full_name,
            studentNumber: user.student_number, // <--- ADD THIS LINE (Critical)
            role: user.role,
            VendorId: vendor ? vendor.vendor_id : null,
            ShopName: vendor ? vendor.shop_name : null,
            VendorStatus: vendor ? vendor.verification_status : null 
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PRODUCTS ---

// Get All (For Home Page)
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await db.query(`SELECT p.*, v.shop_name FROM products p JOIN vendors v ON p.vendor_id = v.vendor_id`);
        const formatted = products.map(p => ({
            productId: p.product_id,
            name: p.name,
            price: p.price,
            description: p.description,
            imageUrl: p.image_url,
            vendor: { shopName: p.shop_name },
            vendorId: p.vendor_id
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get Vendor Specific (For Dashboard)
app.get('/api/products/vendor/:id', async (req, res) => {
    try {
        const [products] = await db.query(`SELECT * FROM products WHERE vendor_id = ? ORDER BY product_id DESC`, [req.params.id]);
        const formatted = products.map(p => ({
            productId: p.product_id,
            name: p.name,
            price: p.price,
            stockQuantity: p.stock_quantity,
            description: p.description,
            imageUrl: p.image_url,
            category: p.category
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create Product
app.post('/api/products', upload.single('ImageFile'), async (req, res) => {
    try {
        const { VendorId, Name, Price, StockQuantity, Category, Description } = req.body;
        
        let imageUrl = '';
        if (req.file) {
            // Construct the full URL (e.g. http://localhost:3000/uploads/image.jpg)
            imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        await db.query(
            `INSERT INTO products (vendor_id, name, price, stock_quantity, category, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [VendorId, Name, Price, StockQuantity, Category, Description, imageUrl]
        );
        res.status(201).json({ message: 'Product Added' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Product
app.put('/api/products/:id', upload.single('ImageFile'), async (req, res) => {
    try {
        const productId = req.params.id;
        const { Name, Price, StockQuantity, Category, Description } = req.body;
        
        // Dynamic Query Building
        let query = `UPDATE products SET name=?, price=?, stock_quantity=?, category=?, description=?`;
        let params = [Name, Price, StockQuantity, Category, Description];

        // Only update image if a new file was sent
        if (req.file) {
            const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            query += `, image_url=?`;
            params.push(imageUrl);
        }

        query += ` WHERE product_id=?`;
        params.push(productId);

        await db.query(query, params);
        res.json({ message: 'Product Updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        // Optional: Get image path first to delete file from disk
        // const [rows] = await db.query('SELECT image_url FROM products WHERE product_id = ?', [req.params.id]);
        
        await db.query(`DELETE FROM products WHERE product_id = ?`, [req.params.id]);
        res.json({ message: 'Product Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ORDERS ---

// Create Order
app.post('/api/orders', async (req, res) => {
    const { customerUserId, vendorId, deliveryLocation, paymentMethod, items } = req.body;
    try {
        let total = 0; 
        const [orderResult] = await db.query(
            `INSERT INTO orders (customer_id, vendor_id, delivery_location, payment_method, total_amount, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [customerUserId, vendorId, deliveryLocation, paymentMethod, 0] 
        );
        const orderId = orderResult.insertId;

        for (const item of items) {
             const [prod] = await db.query('SELECT price FROM products WHERE product_id = ?', [item.productId]);
             const price = prod[0].price;
             total += price * item.quantity;
             await db.query(`INSERT INTO order_items (order_id, product_id, quantity, price_at_order) VALUES (?, ?, ?, ?)`, [orderId, item.productId, item.quantity, price]);
        }
        await db.query(`UPDATE orders SET total_amount = ? WHERE order_id = ?`, [total, orderId]);
        res.json({ orderId: orderId, message: "Order Placed" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get Vendor Orders
app.get('/api/orders/vendor/:id', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, u.full_name as customer_name 
            FROM orders o 
            JOIN users u ON o.customer_id = u.user_id 
            WHERE o.vendor_id = ? 
            ORDER BY o.created_at DESC`, 
            [req.params.id]
        );
        const formatted = orders.map(o => ({
            orderId: o.order_id,
            totalAmount: o.total_amount,
            status: o.status,
            deliveryLocation: o.delivery_location,
            createdAt: o.created_at,
            customer: { fullName: o.customer_name }
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Order Status
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const status = req.body.status || Object.keys(req.body)[0]; 
        await db.query(`UPDATE orders SET status = ? WHERE order_id = ?`, [status, req.params.id]);
        res.json({ message: "Status Updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get Customer Orders (For Profile Page)
app.get('/api/orders/customer/:id', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, v.shop_name 
            FROM orders o 
            JOIN vendors v ON o.vendor_id = v.vendor_id 
            WHERE o.customer_id = ? 
            ORDER BY o.created_at DESC`, 
            [req.params.id]
        );
        
        const formatted = orders.map(o => ({
            orderId: o.order_id,
            totalAmount: o.total_amount,
            status: o.status,
            deliveryLocation: o.delivery_location,
            createdAt: o.created_at,
            shopName: o.shop_name
        }));
        
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Node.js Server running on http://localhost:${PORT}`);
});