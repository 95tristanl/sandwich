/**
 * Created by TristanLeVeille on 7/31/18.
 */
'use strict';

//let http = require('http');
//let https = require("https");
let express = require('express');
let mongoose = require("mongoose");
var bodyParser = require("body-parser");

const setupServer = async () => {
    let app = express();
    //let server = http.createServer(app);

    app.use(express.static(`${__dirname}/../client`));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // Connect to MongoDB
    try {
        //await mongoose.connect("mongodb://localhost:27017/leveiltt"); //mongo on aws or some box
        //console.log("MongoDB connected: mongodb://localhost:32768/leveiltt"); //kitematic
        await mongoose.connect("mongodb://localhost:27017/leveiltt", {useNewUrlParser: true});
        console.log("MongoDB connected: mongodb://localhost:27017/leveiltt"); //kitematic
    } catch (err) {
        //console.log(err);
        console.log("Could not connect to mongo...");
        process.exit(-1);
    }

    // Import Data Model and add our model to our app
    app.models = {
        Game: require("./models/game")
    };

    // Import routes
    require("./api/routes")(app); //pass Data Model into routes

    app.listen(4000, () => { //4000 for aws ,  8080 server.listen for localhost
        console.log('Started on 4000');
    });
};
// Run the server
setupServer();
