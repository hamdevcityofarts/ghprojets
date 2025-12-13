const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

// ----------------------------------------------------
// @desc    Créer un nouvel utilisateur (par Admin)
// @route   POST /api/users
// @access  Admin
// ----------------------------------------------------
const createUser = asyncHandler(async (req, res) => {
    const { 
        name, 
        surname, 
        email, 
        password, 
        role, 
        phone, 
        department, 
        status,
        permissions 
    } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('Un utilisateur avec cet email existe déjà');
    }

    const user = await User.create({
        name,
        surname,
        email,
        password,
        phone,
        department,
        role: role || 'client',
        status: status || 'actif',
        permissions: permissions || [],
        hireDate: req.body.hireDate || null
    });

    if (user) {
        // Exclure le password dans la réponse
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json(userResponse);
    } else {
        res.status(400);
        throw new Error('Données utilisateur invalides');
    }
});

// ----------------------------------------------------
// @desc    Obtenir tous les utilisateurs
// @route   GET /api/users
// @access  Admin
// ----------------------------------------------------
const getUsers = asyncHandler(async (req, res) => {
    // Exclure le mot de passe lors de la récupération
    const users = await User.find({}).select('-password');
    res.json(users);
});

// ----------------------------------------------------
// @desc    Obtenir un utilisateur par ID
// @route   GET /api/users/:id
// @access  Admin
// ----------------------------------------------------
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }
});

// ----------------------------------------------------
// @desc    Mettre à jour un utilisateur
// @route   PUT /api/users/:id
// @access  Admin
// ----------------------------------------------------
const updateUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        user.name = req.body.name || user.name;
        user.surname = req.body.surname !== undefined ? req.body.surname : user.surname;
        user.email = req.body.email || user.email;
        user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;
        user.department = req.body.department !== undefined ? req.body.department : user.department;
        user.status = req.body.status !== undefined ? req.body.status : user.status;
        
        // Mettre à jour le rôle si fourni et valide
        if (req.body.role) {
            const validRoles = ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician', 'client'];
            if (validRoles.includes(req.body.role)) {
                user.role = req.body.role;
            }
        }

        // Mettre à jour les permissions si fournies
        if (req.body.permissions) {
            user.permissions = req.body.permissions;
        }

        // Si l'administrateur change le mot de passe
        if (req.body.password) {
            user.password = req.body.password;
        }
        
        const updatedUser = await user.save();
        
        // Exclure le password dans la réponse
        const userResponse = updatedUser.toObject();
        delete userResponse.password;
        
        res.json(userResponse);

    } else {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }
});

// ----------------------------------------------------
// @desc    Supprimer un utilisateur
// @route   DELETE /api/users/:id
// @access  Admin
// ----------------------------------------------------
const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        // Empêcher la suppression de l'admin principal
        if (user.role === 'admin' && user.email === 'admin@grandhotel.com') {
            res.status(400);
            throw new Error('Impossible de supprimer l\'administrateur principal');
        }
        
        await User.deleteOne({ _id: user._id });
        res.json({ 
            message: 'Utilisateur supprimé avec succès',
            deletedUserId: user._id 
        });
    } else {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
    }
});

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
};