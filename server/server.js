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

    app.use(express.static(`${__dirname}/../client`));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // Connect to MongoDB
    try {
        //await mongoose.connect("mongodb://localhost:27017/leveiltt"); //mongo on aws or some box
        await mongoose.connect("mongodb://localhost:27017/leveiltt", {useNewUrlParser: true});
        //console.log("MongoDB connected: mongodb://localhost:32768/leveiltt"); //kitematic
    } catch (err) {
        //console.log(err);
        process.exit(-1);
    }

    // Import our Data Models
    app.models = {
        Game: require("./models/game")
    };

    // Import our routes
    require("./api")(app);

    server.listen(4000, () => { //4000  8080
        //console.log('Started on 8080');
    });
};
// Run the server
setupServer();
