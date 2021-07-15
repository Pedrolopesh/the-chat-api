const mongoose = require('../index');

const SubscribeSchema = new mongoose.Schema({

    credentials: {
        type: String,
        require: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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