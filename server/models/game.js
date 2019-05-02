/**
 * Created by TristanLeVeille on 4/11/18.
 */

"use strict";

let mongoose = require("mongoose");
let Schema = mongoose.Schema;

let Game = new Schema({
    lord: {type: String},
    roomID: {type: String },
    leavingAlert: {type: String },
    deckSize: {type: Number},
    gameSize: {type: Number},
    handSize: {type: Number},
    refuelNum: {type: Number},
    players: [],
    deck: [],
    cardPile: [],
    battleStack_Players: [],
    battleStack_Moves: [],
    sandwichStack: [],
    sandwichCard: {type: Number},
    sandwicher: { type: String},
    derbyLastPlay: { type: String},
    higherIsBetter: { type: Boolean, default: true },
    startGame: { type: Boolean, default: false },
    gameOver: [],
    end_round: [],
    isBattle: { type: Boolean, default: false },
    isDerby: { type: Boolean, default: false },
    orderOfPlay: {},  //a dictionary, stores who plays after who, order of play
    chatList: [], // list of strings = messeges sent by people
    roundLog: [], // holds [last round winner, his prev score, cards won in that round]
    dict_hands: {},   //a dictionary at 0 index of this list
    dict_varData: {} //a dictionary at 0 index of this list
});

Game.pre("save", function(next) {
    //this.username = this.username.replace(/<(?:.|\n)*?>/gm, '');
    next();
});

module.exports = mongoose.model("Game", Game);
