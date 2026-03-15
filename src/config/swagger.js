// src/config/swagger.js
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const path = require('path'); // AJOUTÉ : Pour gérer correctement les chemins

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Documentation GRAND HOTEL ",
            version: "1.0.0",
            description: "Documentation interactive de ton API Node.js",
        },
        servers: [
            {
                url: "http://localhost:5000/api",
                description: "Serveur local",
            },
        ],
    },

    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],

    // CORRIGÉ : Utilisation de path.join pour un chemin absolu vers src/routes
    apis: [path.join(__dirname, '..', 'routes', '*.js')], 
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerDocs = (app) => {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log("📘 Documentation Swagger disponible sur : http://localhost:5000/api-docs");
};

module.exports = swaggerDocs;
