/**
 * Created by TristanLeVeille on 4/10/18.
 */

/* Copyright TristanLeVeille, @2018 */


"use strict";

module.exports = app => {
    // Creating a new game room ...
    app.post('/createdGame', async (req, res) => {
        try {
            let tmp1 = {};
            let tmp2 = {};
            tmp1[req.body.lord] = [];
            tmp2[req.body.lord] = [0, 0, 0, 0];
            let game = new app.models.Game({
                lord: req.body.lord,
                roomID: req.body.roomID,
                deckSize: req.body.deckSize,
                gameSize: req.body.gameSize,
                handSize: req.body.handSize,
                refuelNum: req.body.refuelNum,
                players: [req.body.lord],
                deck: [], // [cards]
                cardPile: [], // [[cards played], type of play, username]
                battleStack_Players: [],
                battleStack_Moves: [],
                sandwichStack: [],
                derbyLastPlay: "", //keeps track of last played hand in a derby
                higherIsBetter: true,
                startGame: false,
                gameOver: ["F", ""],
                end_round: ["false", ""],
                isBattle: false,
                isDerby: false,
                orderOfPlay: {meh: "poopy"}, //just init with a val that is never going to be used
                chatList: [], //hold last 10 chat messeges
                dict_hands: tmp1,
                dict_varData: tmp2
            });
            await game.save();
            res.status(200).send({});
        } catch(err) {
            console.log("Error creating game... ");
            console.log(err);
        }
    });


    //joining a room
    app.post('/joinedGame', async(req, res) => { //not sure if works
        await app.models.Game.findOne({roomID: req.body.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({error: "Game Not Found!"});
                return __handleError(err);
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    if (Object.keys(schema.dict_hands).length < schema.gameSize) { //schema.players.length < schema.gameSize
                        if (schema.dict_hands[req.body.username] === undefined) {
                            schema.dict_varData[req.body.username] = [0, 0, 0, 0];
                            schema.markModified(`dict_varData.${req.body.username}`); //manually give path to updated object for saving
                            schema.dict_hands[req.body.username] = [];
                            schema.markModified(`dict_hands.${req.body.username}`); //manually give path to updated object for saving
                            schema.players.push(req.body.username);
                            await schema.save();
                            res.status(200).send({});
                        } else {
                            res.status(300).send({err: 'That Username is already Taken!'});
                        }
                    } else {
                        res.status(300).send({err: 'Game Is Full!'});
                    }
                }
            }
        });
    });


    //get a specific games data
    app.post('/getGameData', async(req, res) => {
        await app.models.Game.findOne({roomID: req.body.roomID}, function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
                return __handleError(err);
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    res.status(200).send({
                        lord: schema.lord,
                        roomID: schema.roomID,
                        deckSize: (schema.deckSize * 54),
                        gameSize: schema.gameSize,
                        handSize: schema.handSize,
                        refuelNum: schema.refuelNum,
                        cardPile: schema.cardPile,
                        //battleStack: schema.battleStack,
                        sandwichStack: schema.sandwichStack,
                        startGame: schema.startGame,
                        dict_varData: schema.dict_varData,
                        chatList: schema.chatList,
                        hand: schema.dict_hands[req.body.user]
                    });
                }
            }
        });
    });

    //only posted once by lord to set startGame to true, create the deck, deal the hands and start the game
    app.post('/sendStartGame', async(req, res) => {
        await app.models.Game.findOne({roomID: req.body.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                } else {
                    try {
                        for(let q = 0; q < schema.players.length; q++) { //creates the order of play (whos after who) dictionary
                            if (q === schema.players.length - 1) {
                                schema.orderOfPlay[schema.players[q]] = schema.players[0];
                                schema.markModified(`orderOfPlay.${schema.players[q]}`); // save the dictionary
                            } else {
                                schema.orderOfPlay[schema.players[q]] = schema.players[q+1];
                                schema.markModified(`orderOfPlay.${schema.players[q]}`); // save the dictionary
                            }
                        }
                        schema.startGame = req.body.startGame; //update server startGame to true
                        schema.deck = makeDeck(schema.deckSize); //makes the deck based on the deckSize (number of decks param) and shuffles it
                        for(let key in schema.dict_hands) { //deal to players
                            let hand = [];
                            for (let j = 0; j < schema.handSize; j++) {
                                hand.push(schema.deck[schema.deck.length - 1]); //grab last card in deck (top of pile) and insert into players hand
                                schema.deck.pop(); //get rid of last card in deck that was just dealt to player
                            }
                            schema.dict_hands[key] = sortHand(hand); //add tuple of player username and their hand of cards
                            schema.markModified(`dict_hands.${key}`); //save dict changes
                        }
                        for(let key in schema.dict_varData) { //the lord user starts the game (his turn first)
                            if (key === schema.lord) {
                                schema.dict_varData[key][2] = true;
                            } else {
                                schema.dict_varData[key][2] = false;
                            }
                            schema.dict_varData[key][0] = schema.dict_hands[schema.lord].length; //length of a standard hand, lord as ex
                            schema.dict_varData[key][1] = true;
                            schema.dict_varData[key][3] = 0; //set everyones score to 0
                            schema.markModified(`dict_varData.${key}`); //save dict changes
                        }
                        await schema.save();
                        res.status(200).send({});
                    } catch (err) {
                        res.status(404).send({ error: 'Game Not Found!' });
                        return __handleError(err);
                    }
                }
            }
        });
    });

    //this never sets the players turn to false. Client sets himself to false when he plays.
    //when this is hit, assume player that posted's turn is false unless he/she initiated a battle => isBattle = true
    app.post('/turnOver_update_clientToServer', async(req, res) => {
        let data = JSON.parse(req.body.user_data);
        await app.models.Game.findOne({roomID: data.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    try {
                        console.log("client to serv");
                        console.log(data.usersTurn);
                        console.log(schema.dict_varData);
                        let battleOver = false;
                        let derbyOver = false;
                        let maybeWinner = ""; //won round
                        let isAce = false;
                        let stillIn_count = 0;
                        if (!schema.isDerby) { //only set schema.isDerby if false, if schema.isDerby is true, want to keep it true until round ends
                            schema.isDerby = data.isDerby;
                        }
                        schema.dict_hands[data.user] = data.usersHand; //update dict_hands
                        schema.markModified(`dict_hands.${data.user}`); //save changes to dict_hands
                        schema.dict_varData[data.user][0] = data.usersHand.length; //update amount of cards in his hand
                        schema.dict_varData[data.user][2] = data.usersTurn; //update turn index of dict_varData for user
                        schema.markModified(`dict_varData.${data.user}`); //save changes to dict_varData

                        if (data.isSandwich[0] === "T") {
                            if (schema.isBattle) {
                                for (let i = 0; i < schema.battleStack_Players.length; i++) {
                                    if (schema.battleStack_Players[i] !== data.user) {
                                        schema.dict_varData[schema.battleStack_Players[i]][1] = false; //that person was sandwiched so is no longer in round
                                        schema.markModified(`dict_varData.${schema.battleStack_Players[i]}`);
                                    }
                                }
                                //one or more battlers already submitted their battle move so battleStack move list exists
                                for (let i = 0; i < schema.battleStack_Moves.length; i++) {
                                    //1 prob with sandwiching rn: if 2 peeps are battling, 1 has played a card, other hasn't and a 3rd player sandwiches
                                    //both of them, the player who has played his battle card will lose it...
                                    schema.battleStack_Moves[i][2] = schema.battleStack_Moves[i][2] + " : Lost Card"; //display as lost card
                                    schema.cardPile.unshift(schema.battleStack_Moves[i]); //add lost cards to pile
                                }

                                schema.isBattle = false; //no longer a battle since everyone in it was sandwiched
                                schema.battleStack_Players = []; //reset battleStack
                                schema.battleStack_Moves = []; //reset battleStack
                            } else { //derby or normal so only 1 person is getting sandwiched = prev person
                                schema.dict_varData[data.isSandwich[1]][1] = false; //that person was sandwiched so is no longer in round
                                schema.markModified(`dict_varData.${data.isSandwich[1]}`);
                            }
                        }

                        if (!schema.isBattle && data.isBattle[0] === "T") { //BATTLE, person who just played initiated a battle
                            schema.isBattle = (data.isBattle[0] === "T");
                            for (let key in schema.dict_varData) { //set everyones yourTurn to false but battlers
                                if (key === data.user) { //2 peeps battling
                                    schema.dict_varData[data.user][2] = true; //set person who just instigated battle's turn to true
                                    schema.markModified(`dict_varData.${data.user}`);
                                } else if (key === data.isBattle[1]) {
                                    schema.dict_varData[data.isBattle[1]][2] = true; //person who is being battled has turn = true
                                    schema.markModified(`dict_varData.${data.isBattle[1]}`);
                                } else { //set non battlers turn to false
                                    schema.dict_varData[key][2] = false;
                                    schema.markModified(`dict_varData.${key}`);
                                }
                            }
                            //update battleStack with players battling
                            //schema.battleStack.push([data.user, data.isBattle[1]]); //new battler with no move played yet
                            schema.battleStack_Players.push(data.user);
                            schema.battleStack_Players.push(data.isBattle[1]);
                            schema.cardPile.unshift(data.usersMove); //put move on top of cardPile (in front of array)
                            //now wait for both of them to play their moves then show both

                        } else if (schema.isBattle) { //already was a battle, another person joined, >= 3 person battle
                            //client side has yourTurn already set to true for player that just entered battles
                            let ind = schema.battleStack_Players.indexOf(data.user);
                            if ( ind < 0 ) { //not already in battle, this person joined out of order via battle button
                                schema.battleStack_Players.push(data.user); //new guy joined battle, so battle > 2 people
                                schema.cardPile.unshift(data.usersMove); //put move on top of cardPile (in front of array)
                            } else { //already a part of battle so add his move to stack
                                schema.battleStack_Moves.push(data.usersMove); //add move to existing list of moves
                            }

                            //see who won battle, use short circuit eval because schema.battleStack[1] might not exist if a 3rd or more peeps join battle before
                            //any prev players played their batle moves
                            if (schema.battleStack_Players.length === schema.battleStack_Moves.length) { //everyone has played their battle move
                                //wild 9 could be played so return that in data if played and update schema
                                schema.cardPile.unshift([schema.battleStack_Moves, "battle", "Battle"]);
                                let tmp = schema.battleStack_Moves.slice();
                                let tmp2 = schema.higherIsBetter;
                                let resData = whoWonBattle(tmp, tmp2);
                                schema.higherIsBetter = resData[1]; // [1] bool h is b

                                //send back who won...

                                if (resData[0].length > 1) { // [0] winners
                                    // do another battle...
                                    schema.battleStack_Players = []; //reset battleStack
                                    schema.battleStack_Moves = []; //reset battleStack
                                    for (let key in schema.dict_varData) { //put everyone out
                                        schema.dict_varData[key][1] = false; //stillIn = false
                                        schema.dict_varData[key][2] = false; //yourTurn = false
                                        schema.markModified(`dict_varData.${key}`);
                                    }
                                    for (let i = 0; i < resData[0].length; i++) { //then put tied people back in
                                        schema.battleStack_Players.push(resData[0][i][2]); //recreate the battleStack data structure user list
                                        schema.dict_varData[ resData[0][i][2] ][1] = true; //set stillIn to true for tied battle person
                                        schema.dict_varData[ resData[0][i][2] ][2] = true; //set yourTurn to true for tied battle person
                                        schema.markModified(`dict_varData.${resData[0][i][2]}`); //save
                                    }
                                    //wait for tied players to play their next battle moves
                                } else {
                                    battleOver = true;
                                    maybeWinner = resData[0][0][2]; //won round
                                }
                            }
                            //wait for all people in battle to play their moves
                        } else { //NOT A BATTLE, normal / Derby , one person plays at a time
                            if (schema.isDerby) {
                                if (data.usersMove[1] === "play") {
                                    schema.derbyLastPlay = data.usersMove[2]; //keep track of who "played" last, not "passed", never need to reset this value
                                    schema.cardPile.unshift(data.usersMove);
                                } else {
                                    //player passed
                                }
                                maybeWinner = schema.derbyLastPlay; //no matter what asign a tmp winner, but if round isn't over, does not matter
                                let next = schema.orderOfPlay[data.user];
                                let aFlag = true;
                                while (data.user !== next) { //went in a circle so exit loop, next person should have been found
                                    if (schema.dict_varData[next][1] === true) { //found next player who is still in
                                        //if derby and next person up is also the last person who "played" and not "passed", round is over
                                        if (schema.derbyLastPlay === next) {
                                            break; //derbyOver = true, ends round by breaking before looping to person who is still in but passed
                                        } else { //found next player who is still in who did not play the last played hand
                                            aFlag = false;
                                            schema.dict_varData[next][2] = true;
                                            schema.markModified(`dict_varData.${next}`);
                                            break;
                                        }
                                    } else {
                                        next = schema.orderOfPlay[next]; //increment to next player
                                    }
                                }
                                derbyOver = aFlag; //this ends the round if true
                            } else {
                                console.log("NORMAL PLAY");
                                schema.cardPile.unshift(data.usersMove); //put move on top of cardPile (in front of array)
                                if (data.usersMove[1] === "play" && data.usersMove[0][0].substr(0,2) === "15") { //Ace was played so end round
                                    isAce = true; //only when not a battle and not a derby
                                } else if (data.usersMove[1] === "wild") { //wild 9 was played, update higherIsBetter.
                                    if (data.usersMove[0][0] === "T") {
                                        schema.higherIsBetter = true;
                                    } else {
                                        schema.higherIsBetter = false;
                                    }
                                } else if (data.usersMove[1] === "fold") {
                                    schema.dict_varData[data.user][1] = false; //that person folded so is no longer in round
                                    schema.markModified(`dict_varData.${data.user}`);
                                }

                                if (isAce) { //ace was played outside of a battle
                                    maybeWinner = data.user;
                                } else { //see who is in to determine if the round continues
                                    //continue round?
                                    for (let key in schema.dict_varData) {
                                        if (schema.dict_varData[key][1]) { //if this person is still in increase count
                                            stillIn_count = stillIn_count + 1;
                                            maybeWinner = key;
                                        }
                                        if (stillIn_count > 1) { //speeds up lookup
                                            break; //round is NOT over
                                        }
                                    }
                                }
                            }
                        }

                        console.log(schema.dict_varData);

                        //everything/code comes back here no matter if battle, derby or normal
                        if (!schema.isBattle || battleOver || derbyOver) { //only skip over this if in the middle of a battle
                            if (stillIn_count === 1 || isAce || battleOver || derbyOver) { //round is over.
                                //update score
                                let card_count = 0;
                                for (let x = 0; x < schema.cardPile.length; x++) {
                                    if (schema.cardPile[x][1] === "play" || schema.cardPile[x][1] === "fold") {
                                        card_count = card_count + schema.cardPile[x][0].length;
                                    } else if (schema.cardPile[x][1] === "battle") {
                                        for (let y = 0; y < schema.cardPile[x][0].length; y++) {
                                            card_count = card_count + schema.cardPile[x][0][y][0].length; //num cards played per person in battle
                                        }
                                    } else if (schema.cardPile[x][1] === "wild") {
                                        card_count = card_count + 1;
                                    }
                                }
                                schema.dict_varData[maybeWinner][3] = schema.dict_varData[maybeWinner][3] + card_count; //adds cards from battle to score
                                schema.markModified(`dict_varData.${maybeWinner}`); //save
                                //refuel?
                                console.log("refuel?");
                                let refuledStack = [];
                                let doneCounter = 0;
                                do { //continuous goes around and deals 1 card at a time so cards are dealt evenly amoung players needing refill
                                    doneCounter = 0;
                                    for (let key in schema.dict_hands) {
                                        if (schema.dict_hands[key].length < schema.refuelNum && schema.deck.length > 0) { //refuel
                                            schema.dict_hands[key].push(schema.deck[ schema.deck.length - 1 ]);
                                            schema.markModified(`dict_hands.${key}`); //save
                                            schema.deck.pop(); //get rid of last card in deck that was just dealt to players hand
                                            if (refuledStack.indexOf(key) < 0) { //if player needed to refule and not already in stack, add them
                                                refuledStack.push(key);
                                            }
                                        } else {
                                            doneCounter = doneCounter + 1;
                                        }
                                    }
                                } while (doneCounter < schema.gameSize)
                                /*
                                for (let key in schema.dict_hands) {
                                    if (schema.dict_hands[key].length <= schema.refuelNum) { //refuel
                                        while (schema.dict_hands[key].length <= schema.handSize) { //persons hand size is
                                            schema.dict_hands[key].push(schema.deck[ schema.deck.length - 1 ]);
                                            schema.markModified(`dict_hands.${key}`); //save
                                            schema.deck.pop(); //get rid of last card in deck that was just dealt to players hand
                                        }
                                    }
                                }
                                //sort hand now that new cards were added
                                for (let akey in schema.dict_hands) {
                                    schema.dict_hands[akey] = sortHand(schema.dict_hands[akey])
                                    schema.markModified(`dict_hands.${akey}`);
                                }
                                */
                                //only sort hands of player/s that needed to refule
                                console.log("refuledStack.length " + refuledStack.length);
                                for (let i = 0; i < refuledStack.length; i++) {
                                    schema.dict_hands[refuledStack[i]] = sortHand(schema.dict_hands[refuledStack[i]])
                                    schema.markModified(`dict_hands.${refuledStack[i]}`);
                                }
                                //reset everything for next round since round is over
                                schema.isBattle = false;
                                schema.isDerby = false;
                                schema.end_round = ["true", maybeWinner]; //send winner back to clientside and that round is over
                                //dont do this here, want to see the last move clientside. schema.cardPile = []; //reset cardPile
                                schema.battleStack_Players = [];
                                schema.battleStack_Moves = [];
                                for (let key in schema.dict_varData) { //put everyone back in
                                    schema.dict_varData[key][1] = true; //set stillIn to true for everyone
                                    schema.dict_varData[key][2] = false; //set yourTurn to false for everyone
                                    schema.markModified(`dict_varData.${key}`); //save
                                }
                                //gameOver?
                                if (schema.deck.length === 0) { //even if no cards left in deck, play until only 1 or 0 people left with cards
                                    let guysWithHands_count = 0;
                                    for (let key in schema.dict_hands) {
                                        if (schema.dict_hands[key].length > 0) { //if this person is still in increase count
                                            guysWithHands_count = guysWithHands_count + 1;
                                        }
                                        if (guysWithHands_count > 1) { //speeds up look-up loop
                                            break; //Game is NOT over
                                        }
                                    }
                                    if (guysWithHands_count <= 1) { //game is over
                                        let winner = [schema.lord]; //could be a tie
                                        for (let keyy in schema.dict_varData) {
                                            if (schema.dict_varData[keyy][3] > schema.dict_varData[winner[0]][3]) {
                                                winner = [keyy]; //better than the person or people tied
                                            } else if (schema.dict_varData[keyy][3] === schema.dict_varData[winner][3]) {
                                                winner.push(keyy); //so far is a tie
                                            }
                                        }
                                        schema.gameOver = ["T", winner];
                                    }
                                } else { //game is not over but round is, maybeWinner won round so he starts next round
                                    schema.dict_varData[maybeWinner][2] = true;
                                    console.log(maybeWinner + " won");
                                }
                            } else if (!data.usersTurn && stillIn_count > 1) { // in normal mode, set next person's, whos still in, turn to true
                                console.log("Next up...");
                                //round is not over, if not a battle and cur player has played, find next person still in
                                let next = schema.orderOfPlay[data.user];
                                while (data.user != next) { //went in a circle so exit loop, next person should have been found
                                    if (schema.dict_varData[next][1] === true) { //found next player who is still in
                                        schema.dict_varData[next][2] = true;
                                        schema.markModified(`dict_varData.${next}`);
                                        console.log("NEXT: " + next);
                                        break;
                                    } else {
                                        next = schema.orderOfPlay[next]; //increment to next player
                                    }
                                }
                                if (data.user === next) {
                                    console.log("SOMETHING IS WRONG");
                                }
                            } else {
                                console.log("uhhh...");
                            }
                        } else {
                            //battle isn't over...
                            //wait for all players in battle to play their moves
                        }
                        await schema.save();
                        res.status(200).send({});
                    } catch (err) {
                        console.log(err);
                        res.status(404).send({ error: 'UPDATE after turn FAILED!' });
                        return err;
                    }
                }
            }
        });
    });

    //this just sends data and the hand back, /turnOver_update_clientToServer will do the hand updating/refueling
    app.post('/update_ServerToClient', async(req, res) => {
        await app.models.Game.findOne({roomID: req.body.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
                return __handleError(err);
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    let server_obj = {};
                    server_obj.hand = schema.dict_hands[req.body.user];
                    server_obj.higherIsBetter =  schema.higherIsBetter;
                    server_obj.cardPile = schema.cardPile;
                    server_obj.cardsInDeck = schema.deck.length;
                    server_obj.dict_varData = schema.dict_varData;
                    server_obj.isBattle = schema.isBattle;
                    server_obj.battleStack_Players = schema.battleStack_Players;
                    server_obj.isDerby = schema.isDerby;
                    server_obj.gameOver = schema.gameOver;
                    server_obj.end_round = schema.end_round;
                    server_obj.chatList = schema.chatList;
                    let server_JSON = JSON.stringify(server_obj);
                    res.status(200).send({
                        server_data: server_JSON
                    });
                }
            }
        });
    });

    //saves incoming msgs
    app.post('/start_new_round', async(req, res) => {
        let data = JSON.parse(req.body.user_data);
        await app.models.Game.findOne({roomID: data.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    try {
                        console.log("RESETTING for NEW ROUND");
                        schema.cardPile = []; //reset
                        schema.end_round = ["false", ""]; //reset
                        await schema.save();
                        res.status(200).send({});
                    } catch (err) {
                        res.status(404).send({ error: 'Could not save schema data!' });
                    }
                }
            }
        });
    });

    //saves incoming msgs
    app.post('/chatRoom', async(req, res) => {
        let data = JSON.parse(req.body.user_data);
        await app.models.Game.findOne({roomID: data.roomID}, async function (err, schema) {
            if (err) {
                console.log("Game Not Found!");
                res.status(404).send({ error: 'Game Not Found!' });
            } else {
                if (schema === null) {
                    console.log("No Schema Found!");
                    res.status(300).send({error: "No Schema Found!"});
                } else {
                    try {
                        if (schema.chatList.length > 10) {
                            schema.splice(10, 1); //remove last / 11th element
                        }
                        schema.chatList.unshift(data.user + " : " + data.msg);

                        await schema.save();
                        res.status(200).send({});
                    } catch (err) {
                        res.status(404).send({ error: 'Could not save schema data!' });
                    }
                }
            }
        });
    });

    //deletes mongo room schema after lord leaves room
    app.post('/deleteRoom', async(req, res) => {
        await app.models.Game.findOneAndRemove({roomID: req.body.roomID}, async function (err) {
            if (err) {
                console.log(err);
                res.status(500).send({});
            } else {
                console.log("deleted : " + req.body.roomID);
                res.status(200).send({});
            }
        });
    });
};


//makes the deck based on the deckSize (number of decks param) and shuffles it
function makeDeck(numDecks) {
    let newDeck = [];
    let sumDeck = [];
    //14 is for the 2 jokers
    let deck = ['2c', '2d', '2h', '2s', '3c', '3d', '3h', '3s', '4c', '4d', '4h', '4s', '5c', '5d', '5h',
    '5s', '6c', '6d', '6h', '6s', '7c', '7d', '7h', '7s', '8c', '8d', '8h', '8s', '9c', '9d', '9h', '9s', '10c', '10d', '10h',
    '10s', '11c', '11d', '11h', '11s', '12c', '12d', '12h', '12s', '13c', '13d', '13h', '13s', '14j', '14j', '15c', '15d', '15h', '15s', ];

    for (let i = 0; i < numDecks; i++) {
        sumDeck = sumDeck.concat(deck);
    }

    while (sumDeck.length > 0) {
        let ran = Math.floor((Math.random() * sumDeck.length));
        newDeck.push(sumDeck[ran]);
        sumDeck.splice(ran, 1);
    }
    return newDeck;
}


//sort hand, lowest to highest/joker
function sortHand(hand) {
    console.log(hand);
    console.log("sorting hand");
    let sortedHand = [];
    for (let i = 0; i < hand.length; i++) {
        if (sortedHand.length === 0) {
            sortedHand.push(hand[0]);
        } else {
          let tmp = sortedHand.length;
          for (let j = 0; j < tmp; j++) {
              if ( (parseInt(hand[i].slice(0, hand[i].length - 1))) <=
                   (parseInt(sortedHand[j].slice(0, sortedHand[j].length - 1))) ) {
                   sortedHand.splice(j, 0, hand[i]);
                   break;
              } else if (j === sortedHand.length - 1) {
                   sortedHand.splice(j+1, 0, hand[i]);
              }
          }
        }
    }
    console.log("sorted");
    console.log(sortedHand);
    return sortedHand;
}

function whoWonBattle(battleStack_Moves, higherIsBetter) {
    console.log("in wwB");
    let nineStack = [];
    console.log(battleStack_Moves);
    //find people who played a wild 9 and update
    for (let i = 0; i < battleStack_Moves.length; i++) {
        if (battleStack_Moves[i][1] === "wild") { //wild 9 was played, update higherIsBetter.
            console.log("wild");
            if (battleStack_Moves[i][0][0] === "T") {
                higherIsBetter = true;
            } else {
                higherIsBetter = false;
            }
            nineStack.push(i);
        }
    }
    //remove people who played a wild 9
    for (let i = 0; i < nineStack.length; i++) {
        battleStack_Moves.splice(nineStack[i], 1);
        console.log("rw");
    }
    console.log("ee");
    //now go through stack and see who won, there could be a tie
    let winner = [battleStack_Moves[0]]; //start off assuming this player is winner
    console.log(winner);
    battleStack_Moves.splice(0, 1); //remove start-off winner player
    console.log(battleStack_Moves);
    for (let i = 0; i < battleStack_Moves.length; i++) { //look through rest and compare
        let leadingCard = winner[0][0][0]; //string ex. "12c"

        let curCard = battleStack_Moves[i][0][0]; //string ex. "12c"

        leadingCard = parseInt( leadingCard.substr(0, leadingCard.length - 1) ); //card value
        curCard = parseInt( curCard.substr(0, curCard.length - 1) ); //card value
        console.log(leadingCard);
        console.log(curCard);
        if ( (higherIsBetter && leadingCard < curCard) || (!higherIsBetter && leadingCard > curCard) ) {
            winner = [battleStack_Moves[i]];
            console.log("new leader");
            console.log(winner);
        } else if (leadingCard === curCard) { //tie, so add to winner stack
            winner.push(battleStack_Moves[i]);
            console.log(winner);
        }
    }

    return [winner, higherIsBetter]; //return winner/s and higherIsBetter because it could be updated
}
