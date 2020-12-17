const User = require('../database/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth.json');
const cloudinary = require('cloudinary').v2;

module.exports = {

    create(req, res){

        const { name, email, password } = req.body
        
        if(!name || !email || !password){
            res.status(400).send({
                success: false,
                message: 'Please fill in all fields'
            })
        }
        
        User.findOne({ email:email }).then(user => {
            if(user){
                res.status(200).send({
                    success:false,
                    message:"User Alredy exist"
                })
            }
            else{
                const newUser = new User({
                    name,
                    email,
                    password,
                    status:"active"
                })

                bcrypt.genSalt(10, (err, salt) => bcrypt.hash(newUser.password, salt, (err, hash) => {
                    if(err) throw err;
                    newUser.password = hash;

                    newUser.save()
                    .then(user => {
                        function generateToken(params={}){
                            return jwt.sign(params, authConfig.secret, {
                                expiresIn: 2155926
                            })
                        }

                        res.status(201).send({

                            success: true,
                            _id: user._id,
                            token: generateToken({ id: user.id })

                        })
                    })

                    .catch(err => {
                        console.log(err)
                        return res.status(400).send({
                            success: false,
                            error: err
                        })
                        
                    })
                }))
            }
        })
        
    },

    login(req,res){
        const { email, password }= req.body
        
        //CHECK IF SEND SOMETHING ON BODY.
        if(!email){
            res.status(400).send({
                success: false,
                message: 'Please fill in all necessary fields'
            })
        }
        User.findOne({ email: email }).select('+password')
        .then((user)=> {

            //CHECK IF USER EXIST
            if(!user){
                return res.status(403).send({
                    success: false,
                    error: "email don't exist, try register first"
                })
            }
            else{
                bcrypt.compare(password, user.password)
                .then( (isMacth) => {
                    
                    //CHECK IF PASSWORD IS CORRET
                    if(!isMacth){
                        return res.status(400).json({
                            success: false,
                            message: "User or password do not macth"
                        })
                    }
                    
                    
                    //GENERATE TOKEN SESSION AND RETURN WITH USE ID
                    else{
                        function generateToken(params={}){
                            return jwt.sign(params, authConfig.secret,{
                                expiresIn: 2155926
                            })
                        }
                        console.log("User success logedin")
                        console.log(user._id)
                        return res.status(200).json({
                            success: true,
                            user_id: user._id,
                            token: generateToken({ id: user.id })
                        })
                    }
                })
            }
        })
    },

    index(req, res){
        User.find((err, docs) => {
            if (err) return res.json(err)

            res.json(docs)
        })
    },


    //NECESSÁRIO ARRUMAR ESSA FUNÇÃO
    async update(req, res) {

        const { name, email} = req.body
        const user = req.body.user_id

        // const user = await User.findById(data.user_id)

        if(!name || !email){
            res.send({ message: 'Please fill in all fields'})
        }

        const userUpdated = await User.findByIdAndUpdate(user, {
            name,
            email,
        })
        
        .catch(err => {
            console.log(err)
            res.send({
                success: true,
                error: 'error on update user',
                data: err
            })
        })

        return res.send({
            success: true,
            message: 'succes on update user',
            data: userUpdated
        })
    },

    //ARRUMAR A FUNÇÃO PARA RETORNAR URL DE MANEIRA QUE RESPEITE O AWAIT
    async upLoadUserImage(req, res){
        const file = req.files.photo
        const user = req.body.user_id

        cloudinary.uploader.upload(file.tempFilePath, function (err, result){
            if(err){console.log(err)}

        }).then(async (result) => {
            await User.findByIdAndUpdate(user, {
                img_profile:result.url
            })

            .then((doc) =>{
                res.send({
                    sucess: true,
                    message: 'succes on update user image profile',
                    data: doc
                })
            })

            .catch(err => {
                console.log(err)
                res.send({
                    sucess: true,
                    error: 'error on update user',
                    data: err
                })
            })
        })
        .catch(err => {
            res.send(err)
        })
    },

    find(req, res){
        const id = req.params.id;

        User.findById(id, function (err, doc) {

            if (err) {
                console.log(err)
                res.send(err)
            }
            return res.json(doc)

        })
    },
    
}