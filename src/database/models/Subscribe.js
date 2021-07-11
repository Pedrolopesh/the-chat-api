const mongoose = require('../index');

const SubscribeSchema = new mongoose.Schema({

    credentials: {
        type: String,
        require: true
    },
    user: {
        type: String,
        unique: true,
        require: true,
        lowercase: true
    },

    active:{
        type: String,
        require: false,
    },

}, {
    timestamps: true,
    versionKey: false
})

const Subscribe = mongoose.model('Subscribe', SubscribeSchema)

module.exports = Subscribe