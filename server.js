require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const userRoutes = require('./routes/authRoutes');
const app = express();
const PORT = process.env.PORT || 10000;
const { sequelize } = require('./models');

sequelize.authenticate()
    .then(() => console.log("DB connection established"))
    .catch((err) => console.error("DB connection failed:", err));

// Database Connection 
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname + "/public"));

app.set("trust proxy", 1); // Required for session cookies on Render/Qoddi

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days session expiry
    }),
    cookie: {
        maxAge: 3600000, // 1 hour
        httpOnly: true, // Prevents JavaScript access
        secure: process.env.NODE_ENV === "production", // Only secure in production
        sameSite: "lax" // Helps with cross-site cookies
    }
}));

// Debugging: Check if session storage is working
app.use((req, res, next) => {
    console.log("Session Data:", req.session);
    next();
});

// Set View Engine
app.set("view engine", "ejs");

// Routes
app.use("/", userRoutes);
// app.use('/', chatRoutes);

// Bind Server to `0.0.0.0` for Deployment
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

// 404 Error Middleware
app.use((req, res) => {
    res.status(404).send(`
        <h1>404 - Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <a href="/">Return to Home</a>
    `);
});
