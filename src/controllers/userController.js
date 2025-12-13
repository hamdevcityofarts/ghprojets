const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

// ✅ NOUVELLE SECTION : Mapping rôles → permissions par défaut
const rolePermissionsMap = {
  'admin': [
    'gestion_utilisateurs',
    'gestion_chambres',
    'gestion_reservations',
    'gestion_clients',
    'acces_finances',
    'rapports',
    'parametres_systeme',
    'gestion_menage',
    'gestion_restaurant'
  ],
  'manager': [
    'gestion_chambres',
    'gestion_reservations',
    'gestion_clients',
    'rapports',
    'gestion_menage',
    'gestion_restaurant'
  ],
  'receptionist': [
    'gestion_reservations',
    'gestion_clients'
  ],
  'housekeeper': [
    'gestion_menage'
  ],
  'supervisor': [
    'gestion_chambres',
    'gestion_reservations',
    'gestion_clients',
    'gestion_menage',
    'gestion_restaurant'
  ],
  'technician': [
    'gestion_chambres'
  ],
  'client': [] // Les clients n'ont pas de permissions d'administration
};

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

    // Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Un utilisateur avec cet email existe déjà');
    }

    // ✅ NOUVELLE VALIDATION : Vérifier la cohérence rôle/permissions
    let finalPermissions = permissions || [];
    const roleFromRequest = role || 'client';

    console.log('🔍 Validation backend création utilisateur:', {
        email,
        role: roleFromRequest,
        permissionsReçues: permissions || [],
        permissionsParDéfaut: rolePermissionsMap[roleFromRequest] || []
    });

    // Si admin, forcer toutes les permissions
    if (roleFromRequest === 'admin') {
        finalPermissions = rolePermissionsMap['admin']; // Toutes permissions
        console.log('✅ Forçage permissions admin:', finalPermissions);
    } 
    // Si pas de permissions fournies, appliquer les permissions par défaut du rôle
    else if (!permissions || permissions.length === 0) {
        finalPermissions = rolePermissionsMap[roleFromRequest] || [];
        console.log('✅ Application permissions par défaut pour rôle:', roleFromRequest);
    }

    // Créer l'utilisateur
    const user = await User.create({
        name,
        surname,
        email,
        password,
        phone,
        department,
        role: roleFromRequest,
        status: status || 'actif',
        permissions: finalPermissions,
        hireDate: req.body.hireDate || null
    });

    if (user) {
        // Exclure le password dans la réponse
        const userResponse = user.toObject();
        delete userResponse.password;
        
        console.log('✅ Utilisateur créé avec succès:', {
            _id: user._id,
            role: user.role,
            permissionsCount: user.permissions.length
        });
        
        res.status(201).json(userResponse);
    } else {
        res.status(400);
        throw new Error('Données utilisateur invalides');
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
        const oldRole = user.role;
        const newRole = req.body.role || oldRole;

        console.log('🔍 Validation backend mise à jour utilisateur:', {
            userId: user._id,
            ancienRole: oldRole,
            nouveauRole: newRole,
            permissionsReçues: req.body.permissions
        });

        // Mettre à jour les champs de base
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

        // ✅ NOUVELLE LOGIQUE : Gestion des permissions selon le rôle
        let finalPermissions = req.body.permissions || user.permissions;

        // Si l'utilisateur devient admin, forcer toutes les permissions
        if (newRole === 'admin' && oldRole !== 'admin') {
            finalPermissions = rolePermissionsMap['admin'];
            console.log('✅ Utilisateur devenu admin, toutes permissions activées');
        }
        // Si l'utilisateur n'est plus admin (changement de rôle)
        else if (oldRole === 'admin' && newRole !== 'admin') {
            console.log('⚠️ Ancien admin devenu', newRole);
            // On garde les permissions sélectionnées, mais on pourrait les filtrer
        }
        // Si pas de permissions fournies pour un nouveau rôle, appliquer les permissions par défaut
        else if (!req.body.permissions && req.body.role) {
            finalPermissions = rolePermissionsMap[newRole] || [];
            console.log('✅ Application permissions par défaut pour nouveau rôle:', newRole);
        }

        // Mettre à jour les permissions
        user.permissions = finalPermissions;

        // Si l'administrateur change le mot de passe
        if (req.body.password) {
            user.password = req.body.password;
        }
        
        const updatedUser = await user.save();
        
        // Exclure le password dans la réponse
        const userResponse = updatedUser.toObject();
        delete userResponse.password;
        
        console.log('✅ Utilisateur mis à jour:', {
            _id: updatedUser._id,
            role: updatedUser.role,
            permissionsCount: updatedUser.permissions.length
        });

        res.json(userResponse);

    } else {
        res.status(404);
        throw new Error('Utilisateur non trouvé');
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