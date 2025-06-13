const mysql = require('mysql2/promise');
require('dotenv').config();

let connection;

async function initConnection() {
  if (!connection) {
    connection = await mysql.createConnection(process.env.MYSQL_URL);
  }
  return connection;
}

module.exports = { initConnection };
