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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
    console.log("Created 'uploads' folder.");
}

// --- FILE UPLOAD CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { 
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

app.post('/api/users/register', upload.single('idCardImage'), async (req, res) => {
    let { fullName, studentNumber, password, role, shopName, courseSection } = req.body;
    try {
        let idCardUrl = '';
        if (role === 'BUYER') {
            if (!req.file) { return res.status(400).json({ error: "Buyers must upload a School ID." }); }
            idCardUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        } else if (role === 'VENDOR') {
            if (!shopName) return res.status(400).json({ error: "Enterprise Name is required." });
            fullName = shopName;
            studentNumber = shopName;
            courseSection = "N/A";
        }

        const [existing] = await db.query('SELECT user_id FROM users WHERE student_number = ?', [studentNumber]);
        if (existing.length > 0) return res.status(400).json({ error: "Account already exists." });

        const hashedPassword = hashPassword(password);
        const [userResult] = await db.query(
            `INSERT INTO users (full_name, student_number, password_hash, role, id_card_image) VALUES (?, ?, ?, ?, ?)`,
            [fullName, studentNumber, hashedPassword, role, idCardUrl]
        );
        const newUserId = userResult.insertId;

        if (role === 'VENDOR') {
            await db.query(
                `INSERT INTO vendors (user_id, shop_name, course_section, is_open, verification_status) VALUES (?, ?, ?, ?, 'PENDING')`,
                [newUserId, shopName, courseSection, 0]
            );
        }
        res.status(201).json({ message: 'User registered' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

        res.json({
            UserId: user.user_id,
            fullName: user.full_name,
            studentNumber: user.student_number, 
            role: user.role,
            VendorId: vendor ? vendor.vendor_id : null,
            ShopName: vendor ? vendor.shop_name : null,
            VendorStatus: vendor ? vendor.verification_status : null 
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- PRODUCTS ---

app.get('/api/products', async (req, res) => {
    try {
        const [products] = await db.query(`SELECT p.*, v.shop_name FROM products p JOIN vendors v ON p.vendor_id = v.vendor_id`);
        const formatted = products.map(p => ({
            productId: p.product_id,
            name: p.name,
            price: p.price,
            stockQuantity: p.stock_quantity,
            category: p.category,
            description: p.description,
            imageUrl: p.image_url,
            vendor: { shopName: p.shop_name },
            vendorId: p.vendor_id
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

app.post('/api/products', upload.single('ImageFile'), async (req, res) => {
    try {
        const { VendorId, Name, Price, StockQuantity, Category, Description } = req.body;
        let imageUrl = '';
        if (req.file) imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        await db.query(
            `INSERT INTO products (vendor_id, name, price, stock_quantity, category, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [VendorId, Name, Price, StockQuantity, Category, Description, imageUrl]
        );
        res.status(201).json({ message: 'Product Added' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', upload.single('ImageFile'), async (req, res) => {
    try {
        const { Name, Price, StockQuantity, Category, Description } = req.body;
        let query = `UPDATE products SET name=?, price=?, stock_quantity=?, category=?, description=?`;
        let params = [Name, Price, StockQuantity, Category, Description];

        if (req.file) {
            query += `, image_url=?`;
            params.push(`${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`);
        }
        query += ` WHERE product_id=?`;
        params.push(req.params.id);

        await db.query(query, params);
        res.json({ message: 'Product Updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FORCE DELETE PRODUCT ---
app.delete('/api/products/:id', async (req, res) => {
    try {
        // 1. Find the image and delete it from the folder
        const [rows] = await db.query('SELECT image_url FROM products WHERE product_id = ?', [req.params.id]);
        if (rows.length > 0 && rows[0].image_url) {
            try {
                const filename = rows[0].image_url.split('/').pop();
                const filePath = path.join(__dirname, 'uploads', filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath); // Delete file
                }
            } catch (e) { console.error("Error deleting image file:", e); }
        }

        // 2. Delete items from orders first (Cleanup)
        await db.query(`DELETE FROM order_items WHERE product_id = ?`, [req.params.id]);

        // 3. Delete the product itself
        await db.query(`DELETE FROM products WHERE product_id = ?`, [req.params.id]);
        
        res.json({ message: 'Product Force Deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ORDERS ---

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

app.get('/api/orders/vendor/:id', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, u.full_name as customer_name 
            FROM orders o JOIN users u ON o.customer_id = u.user_id 
            WHERE o.vendor_id = ? ORDER BY o.created_at DESC`, [req.params.id]);

        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await db.query(`
                SELECT oi.quantity, p.name 
                FROM order_items oi JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ?`, [order.order_id]);
            
            return {
                orderId: order.order_id,
                totalAmount: order.total_amount,
                status: order.status,
                deliveryLocation: order.delivery_location,
                createdAt: order.created_at,
                customer: { fullName: order.customer_name },
                items: items 
            };
        }));
        res.json(ordersWithItems);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status required" });
    try {
        await db.query(`UPDATE orders SET status = ? WHERE order_id = ?`, [status, req.params.id]);
        if (status === 'COMPLETED') {
             const [orderItems] = await db.query(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [req.params.id]);
             for (const item of orderItems) {
                 await db.query(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?`, [item.quantity, item.product_id]);
             }
        }
        res.json({ message: "Status Updated" });
    } catch (err) { console.error(err); res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/orders/customer/:id', async (req, res) => {
    try {
        const [orders] = await db.query(`SELECT o.*, v.shop_name FROM orders o JOIN vendors v ON o.vendor_id = v.vendor_id WHERE o.customer_id = ? ORDER BY o.created_at DESC`, [req.params.id]);
        
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await db.query(`
                SELECT oi.quantity, p.name, p.price, p.image_url
                FROM order_items oi JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ?`, [order.order_id]);
            return {
                orderId: order.order_id,
                totalAmount: order.total_amount,
                status: order.status,
                deliveryLocation: order.delivery_location,
                createdAt: order.created_at,
                shopName: order.shop_name,
                items: items 
            };
        }));
        res.json(ordersWithItems);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders/details/:orderId', async (req, res) => {
    try {
        const [items] = await db.query(`SELECT oi.*, p.name, p.image_url, p.price FROM order_items oi JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id = ?`, [req.params.orderId]);
        res.json(items);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN ROUTES ---

app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT u.user_id, u.full_name, u.student_number, u.role, u.id_card_image, u.created_at, 
                   v.vendor_id, v.shop_name, v.verification_status
            FROM users u LEFT JOIN vendors v ON u.user_id = v.user_id ORDER BY u.created_at DESC`);
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/vendors/:vendorId/verify', async (req, res) => {
    const { status } = req.body; 
    try {
        await db.query(`UPDATE vendors SET verification_status = ? WHERE vendor_id = ?`, [status, req.params.vendorId]);
        res.json({ message: `Vendor updated` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FORCE DELETE USER/VENDOR (ADMIN) ---
app.delete('/api/admin/users/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        // 1. Check if Vendor and clean up detailed data
        const [vendors] = await db.query('SELECT vendor_id FROM vendors WHERE user_id = ?', [userId]);
        
        if (vendors.length > 0) {
            const vendorId = vendors[0].vendor_id;
            
            // A. Get all images and delete files
            const [products] = await db.query('SELECT image_url FROM products WHERE vendor_id = ?', [vendorId]);
            products.forEach(p => {
                if (p.image_url) {
                    try {
                        const filename = p.image_url.split('/').pop();
                        const filePath = path.join(__dirname, 'uploads', filename);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    } catch(e) { console.error("Error deleting file:", e); }
                }
            });

            // B. Database Cleanup (Force Delete cascade manually to be safe)
            await db.query('DELETE FROM order_items WHERE product_id IN (SELECT product_id FROM products WHERE vendor_id = ?)', [vendorId]);
            await db.query('DELETE FROM products WHERE vendor_id = ?', [vendorId]);
            await db.query('DELETE FROM orders WHERE vendor_id = ?', [vendorId]);
            await db.query('DELETE FROM vendors WHERE vendor_id = ?', [vendorId]);
        }

        // 2. Delete as Customer (Orders they made)
        await db.query('DELETE FROM orders WHERE customer_id = ?', [userId]);

        // 3. Delete the User Account
        await db.query('DELETE FROM users WHERE user_id = ?', [userId]);

        res.json({ message: "User force deleted" });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// --- ANNOUNCEMENTS ---
app.get('/api/announcements', async (req, res) => {
    try { const [rows] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC'); res.json(rows); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/announcements', async (req, res) => {
    try { await db.query('INSERT INTO announcements (title, message) VALUES (?, ?)', [req.body.title, req.body.message]); res.json({ message: "Posted" }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/announcements/:id', async (req, res) => {
    try { await db.query('DELETE FROM announcements WHERE id = ?', [req.params.id]); res.json({ message: "Deleted" }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Node.js Server running on http://localhost:${PORT}`));