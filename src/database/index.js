const mongoose = require('mongoose');
const key = require('../config/keys').mongoURL

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose.connect(key)
.then( (doc)=> { console.log("Conected with database")  })
.catch( (err) => { console.log(err) })

mongoose.Promise = global.Promise;
module.exports = mongoose;