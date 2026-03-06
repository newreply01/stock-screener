const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const screenerRoutes = require("./routes/screener");
const authRoutes = require("./routes/auth");
const monitorRoutes = require("./routes/monitor");
const { startScheduler } = require("./scheduler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", screenerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/monitor", monitorRoutes);

const distPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) res.status(404).send("Static files not built");
    });
});

const PORT = process.env.PORT || 3000;

function startServer() {
    try {
        if (!process.env.VERCEL) {
            startScheduler();
        }
        console.log("Server started"); 
        app.listen(PORT, () => {
            console.log("PORT: " + PORT);
        });
    } catch (err) {
        process.exit(1);
    }
}

if (!process.env.VERCEL) {
    startServer();
}

module.exports = app;
