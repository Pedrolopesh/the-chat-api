const User = require('../database/models/User');
const Chat = require('../database/models/Chat');

module.exports ={
    async create(req, res){
        const { 
                user_origin,
                user_response,
                chatData
            } = req.body

            const alerdyCreated = await Chat.findOne({user_origin: user_origin , user_response: user_response})

            if(alerdyCreated != null)
                return res.status(200).send({ success: false, error: 'Alredy have a chat', message: alerdyCreated})

            if(!user_origin || !user_response || !chatData)
                return res.status(400).send({ success: false, error: 'Please fill the missing fields'})
            
            
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
            .then(doc =>{
                result = doc
            })
            .catch(err => {
                return res.status(400).send(err)
            })

            
            await User.findByIdAndUpdate(req.body.user_response, {
                $push: {
                    chats: result._id
                }
            })
            .then(doc => {
                console.log("user sender")
                console.log(doc)
            })

            await User.findByIdAndUpdate(req.body.user_origin, {
                $push: {
                    chats: result._id
                }
            })
            .then(doc => {
                console.log("user reciver")
                console.log(doc)
            })

            // .catch(err => {
            //     console.log(err)
            //     res.send({
            //         success: true,
            //         message: 'Faild to add chat on user',
            //         data: err
            //     })
            // })

            return res.send({
                success: true,
                message: 'Success to create chat',
                doc: result
            })


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
    
    async listChatConections(req, res){
        const user_id = req.params.id   
        console.log("seu user é esse mano  =====>"+user_id)
        
        const user_connections = []
        const results_array = []
        
        const user_response_array = await Chat.find({ user_response: user_id })
        const user_origin_array = await Chat.find({ user_origin: user_id })

        user_connections.push(user_response_array)
        user_connections.push(user_origin_array)
        
        let recivers = []

        user_connections.map((result) =>{
            for(let i in result){
                // console.log(result[i])
                let users_response = result[i].user_response
                let users_origin = result[i].user_origin
                
                recivers.push(users_response[0], users_origin[0])
                console.log(recivers)
                
                // let filtered = recivers.filter((item) => { return item.user_origin != user_id || item.user_response != user_id })
                
                // let newArray = {
                //     reciver: result[i].user_origin   
                // }
                // results_array.push(filtered)
            }
            results_array.push(result)
            // results_array.push(filtered)
        })

        // let list_all_connections_chats = {
        //     users_responses: user_response_array,
        //     users_origin: user_origin_array
        // }

        res.send(results_array)




        // // ============ USER RESPONSE CONNECTIONS ============
        // if(user_response_result != ''){
            
        //     user_response_result.map((result) =>{
        //         chat_user_ids.push(result.user_origin)
        //     })
            
        //     let chat_conections = []
        //     for(let i in chat_user_ids){
                
        //         let user_array = await User.findById(chat_user_ids[i]).then(resp => {
        //             let chats = {
        //                 user_id: resp._id,
        //                 name: resp.name,
        //                 imageProfile: resp.imageProfile
        //             }
        //             return chats
        //         })
        //         chat_conections.push(user_array)
        //     }
        //     // return res.send(chat_conections)
            
        // }
        // ============ USER RESPONSE CONNECTIONS ============
        
        
        // else{
        //     // ============ USER ORIGIN CONNECTIONS ============
        //     const user_origin_result = await Chat.find({ user_origin: user_id })
            
        //     user_origin_result.map((result) =>{
        //         chat_user_ids.push(result.user_response)
        //     })
            
        //     let chat_conections = []
        //     for(let i in chat_user_ids){
                
        //         let user_array = await User.findById(chat_user_ids[i]).then(resp => {
        //             let chats = {
        //                 user_id: resp._id,
        //                 name: resp.name,
        //                 imageProfile: resp.imageProfile
        //             }
        //             return chats
        //         })
        //         chat_conections.push(user_array)
        //     }
            
        //     console.log("USER ORIGIN")
        //     return res.send(chat_conections)
        //     // ============ USER ORIGIN CONNECTIONS ============

        // }
        
    },

}