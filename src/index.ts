import cors from "cors";
import express from "express";

import { config } from "./config/config.js";
import bookingsRouter from "./routes/bookings.js";
import programsRouter from "./routes/programs.js";
import packagesRouter from "./routes/packages.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/api/v1/programs", programsRouter);
app.use("/api/v1/packages", packagesRouter);

app.use("/api/v1/bookings", bookingsRouter);
app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port.toString()}`);
});
