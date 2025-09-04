import express from "express";
import programsRouter from "./routes/programs";
import bookingsRouter from "./routes/bookings";
import cors from "cors";
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/api/v1/programs", programsRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
