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
    app.use(express.static(`${__dirname}/../client`));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    try {
        let connectionString = process.env.MONGODB_URI || "mongodb://localhost:27017/sandwich"; // Heroku
        //let connectionString = "mongodb://localhost:27017/leveiltt"; //mongo on aws or some box
        //let connectionString = "mongodb://localhost:32768/leveiltt"; //kitematic
        await mongoose.connect(connectionString, {useNewUrlParser: true});
        console.log("MongoDB connected on: " + connectionString);
    } catch (err) {
        console.log("Could not connect to mongo...");
        process.exit(-1);
    }

    // Import Data Model and add our model to our app
    app.models = {
        Game: require("./models/game")
    };

    // Import routes
    require("./api/routes")(app); //pass Data Model into routes

    let port = process.env.PORT || 4000; //8080
    app.listen(port, () => { //4000 for aws, 8080 for localhost
        console.log("Server started on: " + port);
    });
};

setupServer(); // Run the server
