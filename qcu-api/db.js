// db.js
const mysql = require('mysql2');

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: 'habaanmo', // <--- REPLACE THIS
    database: 'qcu_marketplace_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Allow us to use async/await
const promisePool = pool.promise();

module.exports = promisePool;