// src/controllers/userController.js

const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const { 
  ROLE_PERMISSIONS_MAP, 
  ROLE_DEPARTMENT_MAP 
} = require('../middlewares/authMiddleware');

// -----------------------------------------------------------
// @desc    Créer un nouvel utilisateur (par Admin)
// @route   POST /api/utilisateurs
// @access  Private/Admin (permission: gestion_utilisateurs)
// -----------------------------------------------------------
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

    // ✅ Validation des champs obligatoires
    if (!name || !email || !password || !role) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants: name, email, password, role'
        });
    }

    // ✅ Vérifier si l'utilisateur existe déjà
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
        return res.status(400).json({
            success: false,
            message: 'Un utilisateur avec cet email existe déjà'
        });
    }

    // ✅ Valider le rôle
    const validRoles = ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician', 'client'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            message: `Rôle invalide. Rôles autorisés: ${validRoles.join(', ')}`
        });
    }

    // ✅ LOGIQUE DE PERMISSIONS: Déterminer les permissions finales
    let finalPermissions = [];
    const roleFromRequest = role || 'client';

    console.log('🔍 Création utilisateur - Validation permissions:', {
        email,
        role: roleFromRequest,
        permissionsReçues: permissions || [],
        permissionsParDéfaut: ROLE_PERMISSIONS_MAP[roleFromRequest] || []
    });

    // Si admin, forcer TOUTES les permissions
    if (roleFromRequest === 'admin') {
        finalPermissions = ROLE_PERMISSIONS_MAP['admin'];
        console.log('✅ Utilisateur ADMIN - Toutes permissions activées');
    } 
    // Si pas de permissions fournies, appliquer les permissions par défaut du rôle
    else if (!permissions || permissions.length === 0) {
        finalPermissions = ROLE_PERMISSIONS_MAP[roleFromRequest] || [];
        console.log(`✅ Permissions par défaut appliquées pour le rôle: ${roleFromRequest}`);
    }
    // Si des permissions sont fournies, les valider et les utiliser
    else {
        // Valider que les permissions fournies sont valides
        const validPermissions = Object.values(require('../middlewares/authMiddleware').PERMISSIONS);
        const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
        
        if (invalidPermissions.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Permissions invalides: ${invalidPermissions.join(', ')}`
            });
        }
        
        finalPermissions = permissions;
        console.log(`✅ Permissions personnalisées appliquées pour le rôle: ${roleFromRequest}`);
    }

    // ✅ Déterminer le département
    const finalDepartment = department || ROLE_DEPARTMENT_MAP[roleFromRequest] || '';

    // ✅ Créer l'utilisateur
    try {
        const user = await User.create({
            name: name.trim(),
            surname: surname ? surname.trim() : '',
            email: email.toLowerCase().trim(),
            password, // Le modèle User devrait hasher le mot de passe dans le pre-save hook
            phone: phone || '',
            department: finalDepartment,
            role: roleFromRequest,
            status: status || 'actif',
            permissions: finalPermissions,
            hireDate: req.body.hireDate || null
        });

        // ✅ Exclure le password dans la réponse
        const userResponse = user.toObject();
        delete userResponse.password;
        
        console.log('✅ Utilisateur créé avec succès:', {
            _id: user._id,
            email: user.email,
            role: user.role,
            permissionsCount: user.permissions.length,
            createdBy: req.user.email
        });
        
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Erreur création utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'utilisateur',
            error: error.message
        });
    }
});

// -----------------------------------------------------------
// @desc    Récupérer tous les utilisateurs
// @route   GET /api/utilisateurs
// @access  Private/Admin (permission: gestion_utilisateurs)
// -----------------------------------------------------------
const getUsers = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', role = '' } = req.query;
        const skip = (page - 1) * limit;

        console.log('📋 Récupération des utilisateurs:', {
            userId: req.user._id,
            userRole: req.user.role,
            page,
            limit,
            search,
            role
        });

        // ✅ Construire la requête de filtre
        let query = {};

        // Recherche par nom, prénom ou email
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { surname: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Filtre par rôle
        if (role && role !== 'all') {
            query.role = role;
        }

        // ✅ Compter le total et récupérer les utilisateurs
        const total = await User.countDocuments(query);
        
        const users = await User.find(query)
            .select('-password') // Exclure les mots de passe
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        console.log(`✅ ${users.length} utilisateur(s) trouvé(s) sur ${total} total`);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit),
            users
        });

    } catch (error) {
        console.error('❌ Erreur récupération utilisateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs',
            error: error.message
        });
    }
});

// -----------------------------------------------------------
// @desc    Récupérer un utilisateur par ID
// @route   GET /api/utilisateurs/:id
// @access  Private/Admin (permission: gestion_utilisateurs)
// -----------------------------------------------------------
const getUserById = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            console.log('❌ Utilisateur non trouvé:', req.params.id);
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        console.log(`✅ Utilisateur récupéré: ${user.email}`);

        res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error('❌ Erreur récupération utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'utilisateur',
            error: error.message
        });
    }
});

// -----------------------------------------------------------
// @desc    Mettre à jour un utilisateur
// @route   PUT /api/utilisateurs/:id
// @access  Private/Admin (permission: gestion_utilisateurs)
// -----------------------------------------------------------
const updateUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        const oldRole = user.role;
        const newRole = req.body.role || oldRole;

        console.log('🔍 Mise à jour utilisateur - Validation permissions:', {
            userId: user._id,
            email: user.email,
            ancienRole: oldRole,
            nouveauRole: newRole,
            permissionsReçues: req.body.permissions
        });

        // ✅ Mettre à jour les champs de base
        if (req.body.name !== undefined) user.name = req.body.name.trim();
        if (req.body.surname !== undefined) user.surname = req.body.surname.trim();
        if (req.body.email !== undefined) user.email = req.body.email.toLowerCase().trim();
        if (req.body.phone !== undefined) user.phone = req.body.phone;
        if (req.body.department !== undefined) user.department = req.body.department;
        if (req.body.status !== undefined) user.status = req.body.status;
        
        // ✅ Mettre à jour le rôle si fourni et valide
        if (req.body.role) {
            const validRoles = ['admin', 'manager', 'receptionist', 'housekeeper', 'supervisor', 'technician', 'client'];
            if (validRoles.includes(req.body.role)) {
                user.role = req.body.role;
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Rôle invalide. Rôles autorisés: ${validRoles.join(', ')}`
                });
            }
        }

        // ✅ LOGIQUE DE PERMISSIONS: Déterminer les permissions finales
        let finalPermissions = user.permissions || [];

        // Si l'utilisateur devient admin (changement de rôle), forcer TOUTES les permissions
        if (newRole === 'admin' && oldRole !== 'admin') {
            finalPermissions = ROLE_PERMISSIONS_MAP['admin'];
            console.log('✅ L\'utilisateur est devenu ADMIN - Toutes permissions activées');
        }
        // Si l'utilisateur n'est plus admin (dégradation), garder les permissions sélectionnées
        else if (oldRole === 'admin' && newRole !== 'admin') {
            console.log(`⚠️ Ancien admin devenu ${newRole}`);
            // Les permissions se basent sur les nouvelles fournies ou les permissions par défaut du rôle
            if (req.body.permissions) {
                finalPermissions = req.body.permissions;
            } else {
                finalPermissions = ROLE_PERMISSIONS_MAP[newRole] || [];
            }
        }
        // Si c'est un changement de rôle normal (pas vers/depuis admin)
        else if (req.body.role && req.body.role !== oldRole) {
            // Si des permissions sont fournies, les utiliser
            if (req.body.permissions) {
                finalPermissions = req.body.permissions;
            } else {
                // Sinon appliquer les permissions par défaut du nouveau rôle
                finalPermissions = ROLE_PERMISSIONS_MAP[newRole] || [];
            }
            console.log(`✅ Rôle changé de ${oldRole} vers ${newRole}`);
        }
        // Si pas de changement de rôle mais permissions modifiées
        else if (req.body.permissions) {
            // Valider les permissions
            const validPermissions = Object.values(require('../middlewares/authMiddleware').PERMISSIONS);
            const invalidPermissions = req.body.permissions.filter(p => !validPermissions.includes(p));
            
            if (invalidPermissions.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Permissions invalides: ${invalidPermissions.join(', ')}`
                });
            }
            
            finalPermissions = req.body.permissions;
            console.log('✅ Permissions manuellement modifiées');
        }

        // ✅ Appliquer les permissions finales
        user.permissions = finalPermissions;

        // ✅ Si l'administrateur change le mot de passe
        if (req.body.password) {
            user.password = req.body.password;
            console.log('🔐 Mot de passe changé');
        }
        
        // ✅ Sauvegarder et retourner
        const updatedUser = await user.save();
        
        const userResponse = updatedUser.toObject();
        delete userResponse.password;
        
        console.log(`✅ Utilisateur mis à jour: ${updatedUser.email}`, {
            role: updatedUser.role,
            permissionsCount: updatedUser.permissions.length,
            updatedBy: req.user.email
        });

        res.status(200).json({
            success: true,
            message: 'Utilisateur mis à jour avec succès',
            user: userResponse
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'utilisateur',
            error: error.message
        });
    }
});

// -----------------------------------------------------------
// @desc    Supprimer un utilisateur
// @route   DELETE /api/utilisateurs/:id
// @access  Private/Admin (permission: gestion_utilisateurs)
// -----------------------------------------------------------
const deleteUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // ✅ Empêcher la suppression de l'admin principal
        if (user.role === 'admin' && user.email === (process.env.ADMIN_EMAIL || 'admin@grandhotel.com')) {
            console.log('⛔ Tentative de suppression de l\'admin principal');
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer l\'administrateur principal'
            });
        }

        // ✅ Empêcher de se supprimer soi-même
        if (user._id.toString() === req.user._id.toString()) {
            console.log('⛔ L\'utilisateur a essayé de se supprimer lui-même');
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas supprimer votre propre compte'
            });
        }
        
        // ✅ Supprimer l'utilisateur
        await User.deleteOne({ _id: user._id });

        console.log(`🗑️ Utilisateur supprimé: ${user.email}`, {
            deletedBy: req.user.email
        });

        res.status(200).json({ 
            success: true,
            message: 'Utilisateur supprimé avec succès',
            deletedUserId: user._id,
            deletedEmail: user.email
        });

    } catch (error) {
        console.error('❌ Erreur suppression utilisateur:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur',
            error: error.message
        });
    }
});

// -----------------------------------------------------------
// Exporter tous les contrôleurs
// -----------------------------------------------------------

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
};