/**
 * Created by TristanLeVeille on 7/31/18.
 */
'use strict';

let http = require('http');
//let https = require("https");
let express = require('express');
//let socketio = require('socket.io');
let mongoose = require("mongoose");
var bodyParser = require("body-parser");

const setupServer = async () => {

    let app = express();
    let server = http.createServer(app);
    //let io = socketio(server);
    //io.on('connection', onConnection);

    app.use(express.static(`${__dirname}/../client`));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // Connect to MongoDB
    try {
        //await mongoose.connect("mongodb://localhost:27017/leveiltt");
        await mongoose.connect("mongodb://localhost:32768/leveiltt", {useNewUrlParser: true});
        console.log("MongoDB connected: mongodb://localhost:32768/leveiltt");
    } catch (err) {
        console.log(err);
        process.exit(-1);
    }

    // Import our Data Models
    app.models = {
        Game: require("./models/game")
    };

    // Import our routes
    require("./api")(app);

    server.listen(8080, () => {
        console.log('Started on 8080');
    });

    /*
    var SOCKET_LIST = {};
    function onConnection(sock) {
        sock.id = Math.random();
        SOCKET_LIST[sock.id] = sock;

        sock.emit('msg', 'You are Connected!');
        sock.on('msg', (txt) => io.emit('msg', txt));
    }
    */

};
// Run the server
setupServer();
