import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

import recurringRoutes from "./routes/recurring";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/recurring", recurringRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API listening on http://localhost:${PORT}`);
});
