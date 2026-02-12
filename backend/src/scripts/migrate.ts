import fs from "fs";
import path from "path";
import { pool } from "../db/pool";

(async () => {
  const file = fs.readFileSync(path.resolve(__dirname, "../../../migrations/001_init.sql"), "utf-8");
  await pool.query(file);
  console.log("migrations complete");
  await pool.end();
})();
