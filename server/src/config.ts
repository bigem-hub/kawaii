import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Load from project root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  nodeEnv: process.env.NODE_ENV || "development",
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
  firebase: {
    databaseUrl:
      process.env.FIREBASE_DATABASE_URL ||
      "https://kawaiilife-55132-default-rtdb.firebaseio.com/",
    // The full service-account JSON string. Never expose this to the client.
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT,
  },
};
