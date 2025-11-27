import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Render secret file if it exists, else use local file
const serviceAccountPath =
  fs.existsSync("/etc/secrets/firebaseService.json")
    ? "/etc/secrets/firebaseService.json"
    : path.join(__dirname, "firebaseService.json");

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
