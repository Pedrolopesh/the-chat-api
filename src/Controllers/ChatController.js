const User = require('../database/models/User');
const Chat = require('../database/models/Chat');
// const distinguishUser = require('../utils/distinguishUser');

module.exports ={
    async create(req, res){
        const {
                user_origin,
                user_response,
                chatData
            } = req.body

            //@TO DO
            // PRECISA VERIFICAR SE O CARA JÁ TEM UM CHAT CRIADO POREM A VERIFICAÇÃO DEVE OCORRER TANTO PARA O CASO DO USUÁRIO SER RESPONSE OU ORIGIN
            const alerdyCreated = await Chat.findOne({ user_origin: user_origin , user_response: user_response})
            const secondCreated = await Chat.findOne({ user_origin: user_response , user_response: user_origin})


            if(alerdyCreated != null && alerdyCreated != '' ){
                return res.status(200).send({ success: false, error: 'Alredy have a chat', message: alerdyCreated})
            }
            else if(secondCreated != null && secondCreated != '' ){
                return res.status(200).send({ success: false, error: 'Alredy have a chat', message: secondCreated})
            }
            else if(!user_origin || !user_response || !chatData){
                return res.status(400).send({ success: false, error: 'Please fill the missing fields'})
            }

            else{
                const slect_user_origin = await User.findById( user_origin )

                const slect_user_response = await User.findById( user_response )

                if(slect_user_origin == null){
                    return res.status(404).send({ success: false, error: 'user not found'})
                }

                else if(slect_user_response == null){
                    return res.status(404).send({ success: false, error: 'error on create chat'})
                }

                const newChat = new Chat ({
                    user_origin: slect_user_origin._id,
                    user_response: slect_user_response._id,
                    status: 'new',
                    chatData
                })

                let result
                await newChat.save()
                .then(doc =>{ result = doc })
                .catch(err => { return res.status(400).send(err) })

                await User.findByIdAndUpdate(req.body.user_response, {
                    $push: {
                        chats: result._id
                    }
                })
                await User.findByIdAndUpdate(req.body.user_origin, {
                    $push: {
                        chats: result._id
                    }
                })
                .catch(err => { res.send({ success: true, message: 'Faild to add chat on user', error: err }) })

                return res.send({ success: true, message: 'Success to create chat', doc: result })
            }
    },

    async sendMessage(req, res){
        const {
            chat_id,
            chatData
        } = req.body


        if(!chatData || !chat_id )
            return res.send({message: "Please fill the missing fields"})


        Chat.findByIdAndUpdate(chat_id, {

            $push: { chatData:chatData }

        }, (err, doc) => {

            if (err) return res.status(400).send(err);

            else if(doc == null) return res.status(400).send({ message: "Chat não encontrado"});

            else return res.status(200).send({ message: "Mensagem enviada", data: doc});

        })
    },

    index(req, res){

        console.log("foi aqui");

        Chat.find((err, docs) => {
            if (err) return res.json(err)

            res.json({
                success: true,
                message: docs
            })
        })

    },

    async listMessageChatbById(req, res){

        const id = req.params.id;

        const result = await Chat.findById(id, function (err, doc) {

            if (err) {
                console.log(err)
                return res.send(err)
            }

        })
        .populate('user_origin')
        .populate('user_response')

        return res.json(result)
    },
    async listChatConectionsByUserId(req, res){
        const user_id = req.params.id

        const user_response_array = await Chat.find({ user_response: user_id })
        .populate('user_origin')
        .populate('user_response')

        const user_origin_array = await Chat.find({ user_origin: user_id })
        .populate('user_origin')
        .populate('user_response')

        return res.send({success: true, user_response_mesage:user_response_array, user_origin_message: user_origin_array})
    },

}