import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export function loadEnv() {
  const localPath = path.resolve(process.cwd(), ".env");
  const parentPath = path.resolve(process.cwd(), "..", ".env");

  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath });
  }

  if (fs.existsSync(parentPath)) {
    dotenv.config({ path: parentPath, override: false });
  }
}

export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is missing. Add it to your environment before starting the backend.`);
    error.statusCode = 500;
    throw error;
  }
  return value;
}
