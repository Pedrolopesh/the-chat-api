const mongoose = require('../index');

const UserSchema = new mongoose.Schema({

    name: {
        type: String,
        require: true
    },
    email: {
        type: String,
        unique: true,
        require: true,
        lowercase: true
    },

    img_profile:{
        type: String,
        require: false,
    },

    confirmCode:{
        type: String,
        require: false,
    },

    password: {
        type: String,
        require: true,
        select: false
    },

    chats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat'
    }],

    status: {
        type: String,
        require: false,
        enum: ['active', 'blocked', 'inative'],
    },

    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscribe'
    },

    createdAt: {
        type: Date,
        default:Date.now,
    },

}, {
    timestamps: true,
    versionKey: false
})

const User = mongoose.model('User', UserSchema)

module.exports = User