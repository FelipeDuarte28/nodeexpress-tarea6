const express = require("express");
const cors = require('cors');
const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { Pool } = require("pg");
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: '123',
    database: 'softjobs',
    port: 5432,
    allowExitOnIdle: true,
});

app.use(cors());
app.use(express.json());

// Reporte de consultas recibidas en el server
app.use((req, res, next) => {
    console.log(`Consulta recibida: ${req.method} ${req.url}`);
    next();
});

// Verifica la existencia de credencial
const checkCredentials = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email y contraseña obligatorios" });
    }
    next();
};

// Valida el token recibido en las cabeceras
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Token de autenticación no proporcionado" });
    }

    jwt.verify(token, "clave_secreta", (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Token de autenticación inválido" });
        }
        req.email = decoded.email;
        next();
    });
};

// Ruta para registrar nuevos usuarios
app.post("/usuarios", checkCredentials, async (req, res) => {
    const { email, password, rol, language } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    try { // "lenguage" venia mal escrito en la base de sql y me di cuenta despues
        const query = "INSERT INTO usuarios (email, password, rol, lenguage) VALUES ($1, $2, $3, $4) RETURNING *";
        const values = [email, hashedPassword, rol, language];
        const result = await pool.query(query, values);
        res.json(result.rows[0]);if (!email || !password)
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al registrar el usuario" });
    }
});

// Ruta para generar un token de autenticacion
app.post("/login", checkCredentials, async (req, res) => {
    const { email, password } = req.body;

    try {
        const query = "SELECT * FROM usuarios WHERE email = $1";
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }

        const user = result.rows[0];
        const passwordMatch = bcrypt.compareSync(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Email o contraseña incorrectos" });
        }

        const token = jwt.sign({ email: user.email }, "clave_secreta", { expiresIn: "1h" });
        res.json(token);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al iniciar sesión" });
    }
});

// Obtencion del usuario autenticado
app.get("/usuarios", verifyToken, async (req, res) => {
    const { email } = req;

    try {
        const query = "SELECT * FROM usuarios WHERE email = $1";
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const user = result.rows[0];
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener los datos del usuario" });
    }
});

// Captura de errores
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: "Error en el servidor" });
});

// Inicio server
app.listen(3000, () => {
    console.log("Servidor ejecutado en port 3000");
});
