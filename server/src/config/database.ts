import {Pool} from 'pg'
import 'dotenv/config'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("connect", () => {
    console.log("Database connection established successfully!!!!");
});

pool.on("error", (err) => {
    console.log("Error occurred while connecting with db: ", err);
});

export default pool;