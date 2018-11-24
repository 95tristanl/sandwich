/**
 * Created by TristanLeVeille on 8/4/18.
 */
/* ARCHITECTURE:
Server does all the score updating, round and game over and other calculations.
Client displays data and sends server info on a players move.

1.) Server deals and sets everything up.
2.) Client continuously grabs data from server once game starts.
3.) Client sends data to server only after user finishes his/her turn.
    Client never updates its own data (protects against race conditions), instead, sends tmp data to server and server will eventually update clients data
4.) Server does calculations upon receiving data from client

so circle: server (data)-> client,    if clients turn/turn just finishes (data)-> server
*/

"use strict";

class Player {
    constructor(username) {
        this.lord = "";
        this.username = username; //your username
        this.hand = []; //the cards in your hand
        this.hand_toServ = [];
        this.cardSelectedStack = []; //cards selected in his hand (list of img ids)
        this.cardSelectedStack_toServ = []; //same as cardSelectedStack but just img string, not entire div or hand string
        this.playedMove_toServ = []; //a tmp var that is used to send the played move of user to server
        this.cardPile = []; //playing pile an array of arrays, usually each is an array having a single card item, Derby items have multiple cards
        this.cardsInDeck = -1; //amount of cards still in the deck
        this.stillIn = true; //are you still in the round
        this.yourTurn = false; //is it your turn to play
        this.yourTurn_FirstCall = true; //keeps track of first time the interval is called during a players turn
        this.hasPlayed = false; //user has played or not
        this.higherIsBetter = true; //higher cards are better
        this.startGame = false;
        this.gameOver = ["F", ""];
        this.isBattle = false;
        this.isDerby = false;
        this.isDerby_toServ = false;
        this.isBattle_toServ = ["F", ""];
        this.isSandwich_toServ = ["F", ""];
        this.battleStack_Players = [];
        this.score = 0; //how many cards have you won
        this.gameSize = -1;
        this.dict_varData = {}; // dict of users , user : [handSize, stillIn, yourTurn, score]
        this.refuelNum = 0;
    }
}

var lord = "asdfnsdafjknasdjkfnasdkjfasdnfnmbewmmkrnq";
var roomID = "asjnfkajsdfhnsdajkfnrfnreuhyrewoncjbas";
var user = new Player(localStorage.getItem('curUser')); // Retrieves from browser storage
var timeoutVar = "";
var keepUpdating = "" //an interval that continuously updates client with current game data

//once html page loads this is called - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
window.onload = () => {
    document.getElementById('startGameButton').style.display = "none"; //hide the start button from everyone
    document.getElementById("battleButton").style.display = "none";
    document.getElementById("nineButton").style.display = "none";
    document.getElementById("foldButton").style.display = "none";
    document.getElementById("passButton").style.display = "none";
    document.getElementById("playButton").style.display = "none";
    let hl = window.location.href;
    let ind = hl.indexOf("roomID");
    roomID = hl.substr(ind + 7);
    document.getElementById("uname").innerHTML = user.username;
    let waitToStartGame_interv = setInterval(waitToStartGame, 1000);

    function waitToStartGame() {
        $.post('/getGameData',
            {
                roomID: roomID,
                user: user.username
            },
            function(data, status){
                document.getElementById("p1").innerHTML = data.lord;
                document.getElementById("p2").innerHTML = data.roomID;
                document.getElementById("p3").innerHTML = data.gameSize;
                document.getElementById("p4").innerHTML = data.deckSize;
                document.getElementById("p5").innerHTML = data.handSize;
                document.getElementById("p6").innerHTML = data.refuelNum;
                user.lord = data.lord;
                user.hand = data.hand;
                user.refuelNum = data.refuelNum;
                user.gameSize = data.gameSize;
                user.startGame = data.startGame;
                user.cardsInDeck = data.deckSize;
                user.dict_varData = data.dict_varData;
                document.getElementById("cardDeck").innerHTML = "Cards Left: " + user.cardsInDeck; //display num cards left in deck
                document.getElementById("peeps_R").remove();
                let tr_ = document.createElement('tr');
                tr_.id = "peeps_R";
                document.getElementById("peeps_T").appendChild(tr_);
                for(let key in user.dict_varData) { //will create divs with every joined player's name
                    var td_ = document.createElement("td");
                    var div_ = document.createElement("div");
                    div_.style.backgroundColor = "green";
                    div_.style.width = "100px";
                    div_.style.height = "75px";
                    div_.style.color = "black";
                    div_.style.textAlign = "center";
                    div_.style.verticalAlign = "middle";
                    div_.style.lineHeight = "20px";
                    div_.style.borderRadius = "20px";
                    div_.innerHTML = key + "<br />" + "Cards: "+user.hand.length + "<br />" + "score: 0"; //players name and score
                    div_.id = "sb_" + key;
                    document.getElementById("peeps_R").appendChild(td_).appendChild(div_);
                }
                if (user.username === user.lord && !user.startGame) { //startgame button only appears for (lord) creator of room, once clicked will try and start game
                    document.getElementById('startGameButton').style.display = "block"; //display button
                }
                if (user.startGame) {
                    clearInterval(waitToStartGame_interv); //interval is stopped -> startGame is true -> everyone is here and lord pressed start button
                    setHand();
                    keepUpdating = setInterval(playGame_keepUpdatingFromServer, 1000); //this starts game. goes every 3sec
                }
        });
    }
};
// on window load - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


/*
//messaging - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function onMsg(text) {
    var list = document.getElementById('chatList');
    var el = document.createElement('li');
    el.innerHTML = text;
    list.appendChild(el);
}

document.getElementById('chat-form').addEventListener('submit', function(e) {
    var input = document.getElementById('chat-input');
    var value = input.value;
    input.value = '';        // reset input
    sock.emit('msg', value); // send inputed text
    e.preventDefault();
});
//messaging - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
*/


//called when startGame Button is clicked so only lord can enter this function and only if all players are in the room
function startGame_justLord() {
    if (Object.keys(user.dict_varData).length === user.gameSize) {
        let setVal = true;
        $.post('/sendStartGame',
            {
                roomID: roomID,
                startGame: setVal
            },
            function(data, status) {
                console.log("SUCCESS on sending startGame!");
            });
        document.getElementById('startGameButton').style.display = "none";
    } else {
        alert("Sorry, can't start until everyone is here.");
    }
}

//continuous game loop
//query server 4 times a second to keep grabing game data
//play on your turn
/*
function startGame() {
    console.log("STARTING the GAME!");
    keepUpdating = setInterval(playGame_keepUpdatingFromServer, 3000); //every sec
}
*/

//displays each players handSize, stillIn, yourTurn, score
function scoreboard(server_dict_varData) {
    for (let key in user.dict_varData) {
        //update paly typle box
        let pt_div = document.getElementById("playType");
        if (!user.isBattle && !user.isDerby && pt_div.style.backgroundColor !== "limegreen") { //normal
            console.log("Scoreboard in Norm. ");
            pt_div.style.backgroundColor = "limegreen";
            pt_div.innerHTML = "Normal";
        } else if (user.isBattle && pt_div.innerHTML !== "Battle!!") {
            console.log("Scoreboard in Battle. ");
            pt_div.style.backgroundColor = "deepskyblue";
            pt_div.innerHTML = "Battle!!";
        } else if (user.isDerby && pt_div.innerHTML !== "Derby!") {
            console.log("Scoreboard in Derby. ");
            pt_div.style.backgroundColor = "orange";
            pt_div.innerHTML = "Derby!";
        }
        //still in update
        if (server_dict_varData[key][1] !== user.dict_varData[key][1]) {
            let div_ = document.getElementById("sb_" + key);
            if (server_dict_varData[key][1]) {
                div_.style.backgroundColor = "green";
            } else {
                div_.style.backgroundColor = "red";
            }
        }
        //whos turn update
        if (server_dict_varData[key][2] !== user.dict_varData[key][2]) {
            let div_ = document.getElementById("sb_" + key);
            if (server_dict_varData[key][2]) {
                div_.style.borderStyle = "solid";
                div_.style.borderWidth = "10px";
                div_.style.borderColor = "gold";
            } else {
                div_.style.borderStyle = "solid";
                div_.style.borderWidth = "2px";
                div_.style.borderColor = "black";
            }
        }
        //cards in hand and score update
        if (server_dict_varData[key][0] !== user.dict_varData[key][0]
            || server_dict_varData[key][3] !== user.dict_varData[key][3] ) {
            let div_ = document.getElementById("sb_" + key);
            div_.innerHTML = key + "<br />" + "Cards: "+server_dict_varData[key][0] + "<br />" + "score: "+server_dict_varData[key][3]; //players name and score
        }
    }
}

//updates client with data from server/other players
function playGame_keepUpdatingFromServer() { //called every timestep (some amount of seconds) COMING FROM SERVER
    $.post('/update_ServerToClient',
        {
            roomID: roomID,
            user: user.username
        },
        function(data, status) {
            let server_data = JSON.parse(data.server_data);
            console.log("test_TEST: " + server_data.tester);
            if (user.higherIsBetter !== server_data.higherIsBetter) { //only update if incoming flag is diff from users flag
                user.higherIsBetter = server_data.higherIsBetter;
                if (server_data.higherIsBetter) {
                    document.getElementById("value").innerHTML = "Higher is Better";
                } else {
                    document.getElementById("value").innerHTML = "Lower is Better";
                }
            }
            user.isBattle = server_data.isBattle;
            user.isDerby = server_data.isDerby;
            console.log("isDerby? " + user.isDerby);
            user.battleStack_Players = server_data.battleStack_Players;
            user.hand = server_data.hand; //update before setHand() below
            if (user.cardPile.length < server_data.cardPile.length) { //if incoming data is diff then update
                renderLastPlayed(server_data.cardPile[0]);
                //renderCardPile();
            } else if (server_data.cardPile.length === 0 && user.cardPile.length !== 0) {
                user.isDerby_toServ = false;
                resetCardPile(); //resets card pile because round ended and incoming card pile is empty so user pile should be too
                alert("New Round!");
                setHand(); //can only refuel after a round is over.
            }
            user.cardPile = server_data.cardPile;
            scoreboard(server_data.dict_varData); // update displays of each players: handSize, stillIn, yourTurn, score
            user.dict_varData = server_data.dict_varData;
            user.yourTurn = server_data.dict_varData[user.username][2]; //updates if its your turn
            user.gameOver = server_data.gameOver;
            if (user.cardsInDeck !== server_data.cardsInDeck) {
                user.cardsInDeck = server_data.cardsInDeck;
                document.getElementById("cardDeck").innerHTML = "Cards Left: " + user.cardsInDeck; //display num cards left in deck
            }
            playGame_afterServerUpdate();
    });
}

//continuous functionality of client if its his turn or not
function playGame_afterServerUpdate() { //called every second
    if(user.gameOver[0] === "F") { //instead of using a while loop, use an interval
        //toggle display of action buttons if user is still in or not
        if (user.stillIn) {
            document.getElementById("foldButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
            document.getElementById("playButton").style.display = "none";
            document.getElementById("battleButton").style.display = "block";
            document.getElementById("passButton").style.display = "none";
        } else {
            document.getElementById("foldButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
            document.getElementById("playButton").style.display = "none";
            document.getElementById("battleButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
        }
        //begin users turn
        if (user.yourTurn) { //should be true, server should set this to true
            if (user.yourTurn_FirstCall) {
                if (user.isBattle) {
                    alert("BATTLE!");
                }
                alert('Your Turn');
                user.yourTurn_FirstCall = false;
            }

            if (user.hand.length > 0) {
                document.getElementById("battleButton").style.display = "none"; //only show when not your turn
                document.getElementById("playButton").style.display = "block";
                document.getElementById("foldButton").style.display = "block";
                document.getElementById("passButton").style.display = "none";
                if (user.isDerby) {
                    document.getElementById("passButton").style.display = "block";
                }
                //toggle display of action buttons during a Derby
                let lastPlay = '';
                for (let i = 0; i < user.cardPile.length; i++) {
                    if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                        lastPlay = user.cardPile[i][0];
                        break;
                    }
                }
                if (lastPlay === '' || lastPlay.length === 1) {
                    document.getElementById("foldButton").style.display = "block";
                    document.getElementById("passButton").style.display = "none";
                } else if (lastPlay.length > 1) { //derby
                    document.getElementById("foldButton").style.display = "none";
                    document.getElementById("passButton").style.display = "block";
                }

                //let timeoutNum = 20000;
                //let startTimeMS = (new Date()).getTime();
                //let timeoutVar = setTimeout(autoPlay, 20000); //20 seconds
                //let divClock = document.getElementById("clock");
                //divClock.style.backgroundColor = "gray";

                if(!user.hasPlayed) { //while user has not played, should start as false
                    //timer stuff
                    /*
                    let timeLeft = timeoutVar - ( (new Date()).getTime() - startTimeMS);

                    if ( timeLeft % 1000 === 0 ) {
                        if (timeLeft > 10000) {
                            divClock.style.backgroundColor = "green";
                            divClock.innerHTML = timeLeft/1000;
                        } else if (timeLeft <= 10000 && timeLeft > 5000) {
                            divClock.style.backgroundColor = "orange";
                            divClock.innerHTML = timeLeft/1000;
                        } else if (timeLeft <= 5000) {
                            divClock.style.backgroundColor = "red";
                            divClock.innerHTML = timeLeft/1000;
                        }
                    }
                    */

                } else { //played
                    user.yourTurn = false; //reset turn bool
                    user.hasPlayed = false; //reset hasPlayed bool
                    user.yourTurn_FirstCall = true;
                    let post_obj = {};
                    post_obj.roomID = roomID;
                    post_obj.user = user.username;
                    post_obj.usersHand = user.hand_toServ;
                    post_obj.usersMove = user.playedMove_toServ;
                    post_obj.usersTurn = user.yourTurn;
                    post_obj.isBattle = user.isBattle_toServ;
                    post_obj.isSandwich = user.isSandwich_toServ;
                    post_obj.isDerby = user.isDerby_toServ;
                    let post_JSON = JSON.stringify(post_obj);
                    console.log("Posting isDerby: " + user.isDerby_toServ);
                    //once played, send data to server, only after your turn
                    $.post('/turnOver_update_clientToServer',
                        {
                            user_data: post_JSON
                        },
                        function(data, status) {
                            //reset
                            user.isBattle_toServ = ["F", ""];
                            user.isSandwich_toServ = ["F", ""];
                            console.log("SUCCESS!! on sending data to SERVER!");
                    });
                }
            } else { //ran out of cards...
                user.stillIn = false;
                user.yourTurn = false;
            }
        } else { //not your turn so wait
            if (user.battleStack_Players.indexOf(user.username) >= 0) { //if user is already playing in a battle, remove the battle button
                document.getElementById("battleButton").style.display = "none";
                console.log("No battle button, already in bat");
            } else {
                document.getElementById("battleButton").style.display = "block";
                console.log("batt");
            }
        }
    } else { //game is over
        clearInterval(keepUpdating); //stop client from querying server
        alert("GAME OVER! Winner: " + user.gameOver[1]);
    }
    //using if statements not while statements so eveything waiting/ending related is in the else block
}


function pass() {
    console.log("Passed!");
    user.playedMove_toServ = [[], 'pass', user.username];
    resetSelected(); //remove cards from cardSelectedStack after action
    user.hasPlayed = true;
    user.stillIn = true;
    user.yourTurn = false; //reset turn bool
    console.log("passing, isDerby: " + user.isDerby);
}

function battleSandwich() { //if was not clients turn but decided to battle/sandwhich
    let playable = true;
    let lastPlay = '';
    let lastFoe = '';

    if ( user.cardSelectedStack.length === 1 || (user.cardSelectedStack.length > 1 && allSame()) ) { //if all cards selected are same or a single card is chosen: valid so far
        for (let i = 0; i < user.cardPile.length; i++) {
            if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                lastPlay = user.cardPile[i][0];
                lastFoe = user.cardPile[i][2];
                break; //the reason we loop instead of picking top of queue is because we only play against 'play' cards, not wild or fold cards.
            }
        }

        if (lastPlay === '') { //user is first to play this round so as long as user doesn't play more than 1 card he can play anything
            playable = false;
            alert("Can't battle! No one has played yet!");
        } else if (lastFoe === user.username) {
            playable = false;
            alert("Can't battle yourself!");
        } else { //someone played before user, must beat that card(s)
            let usersCard = user.cardSelectedStack[0].split("_")[3].substr(0, user.cardSelectedStack[0].split("_")[3].length - 1); //card value
            let lastPlayedCard = lastPlay[0].substr(0, lastPlay[0].length - 1); //card value
            usersCard = parseInt(usersCard); //was string
            lastPlayedCard = parseInt(lastPlayedCard);  //was string

            if (usersCard === lastPlayedCard) {
                if (user.cardSelectedStack.length === lastPlay.length) {
                    user.isBattle_toServ = ["T", lastFoe]; //set flag to indicate battle order of play
                    alert("BATTLE!"); // valid, BATTLE
                } else if (user.cardSelectedStack.length < lastPlay.length) {
                    playable = false; // not valid
                    alert("Its a Derby. You need to play more cards!");
                } else if (user.cardSelectedStack.length > lastPlay.length) {
                    user.isSandwich_toServ = ["T", lastFoe];
                    alert("SANDWICH! And a DERBY!");
                }
                if (playable && user.cardSelectedStack.length > 1) {
                    user.isDerby_toServ = true; //set flag to indicate derby order of play
                    console.log("set isDerby to TRUE");
                }
            } else {
                playable = false; // not valid battle
                alert("your cards must be the exact same as the previous cards played!");
            }
        }
    } else { //cards played were not all the same value
        playable = false; // not valid
        alert("Cannot play different types of cards!");
    }

    if (playable) {
        console.log("BATTLED/SANDWICHED a person!");
        removeSelectedFromHand("");
        user.playedMove_toServ = [user.cardSelectedStack_toServ, 'play', user.username]; //going to serv
        resetSelected(); //remove cards from cardSelectedStack after action
        user.stillIn = true;
        user.yourTurn = true; //reset turn bool
        postClientDataToServer();
        let post_obj = {};
        post_obj.roomID = roomID;
        post_obj.user = user.username;
        post_obj.usersHand = user.hand_toServ;
        post_obj.usersMove = user.playedMove_toServ;
        post_obj.usersTurn = user.yourTurn;
        post_obj.isBattle = user.isBattle_toServ;
        post_obj.isSandwich = user.isSandwich_toServ;
        post_obj.isDerby = user.isDerby_toServ;
        let post_JSON = JSON.stringify(post_obj);
        console.log("Sending... - - - - - .");
        //once played, send data to server, only after your turn
        $.post('/turnOver_update_clientToServer',
            {
                user_data: post_JSON
            },
            function(data, status) {
                //reset
                user.isBattle_toServ = ["F", ""];
                user.isSandwich_toServ = ["F", ""];
                console.log("SUCCESS!! on sending data to SERVER!");

        });
    }
}

//user has pressed the play button, display selected hand cards in pile
function play() {
    if (user.yourTurn) { // Validation below
        let playable = true;
        let lastPlay = '';
        let lastFoe = '';
        if ( user.cardSelectedStack.length === 1 || (user.cardSelectedStack.length > 1 && allSame()) ) { //if all cards selected are same or a single card is chosen: valid so far
            if (user.isBattle) {
                console.log("Playing INTO A BATTLE");
                if (user.cardSelectedStack.length !== 1) {
                    playable = false; //have to play a single card
                    alert("You only play one card in a battle.");
                } else {
                    //valid, can play any single card. Who wins functionality is on server side
                }
            } else { //not a battle
                for (let i = 0; i < user.cardPile.length; i++) {
                    if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                        lastPlay = user.cardPile[i][0];
                        lastFoe = user.cardPile[i][2];
                        break; //the reason we loop instead of picking top of queue is because we only play against 'play' cards, not wild or fold cards.
                    }
                }
                if (lastPlay === '') { //user is first to play this round so as long as user doesn't play more than 1 card he can play anything
                    if (user.cardSelectedStack.length > 1) { //cant start with a derby
                        playable = false;
                        alert("Can't start a round by playing multiple cards (Derby).");
                    }
                } else { //someone played before user, must beat that card(s)
                    let usersCard = user.cardSelectedStack[0].split("_")[3].substr(0, user.cardSelectedStack[0].split("_")[3].length - 1); //card value
                    let lastPlayedCard = lastPlay[0].substr(0, lastPlay[0].length - 1); //card value
                    usersCard = parseInt(usersCard); //was string
                    lastPlayedCard = parseInt(lastPlayedCard);  //was string

                    if (user.cardSelectedStack.length === lastPlay.length) {
                        if (user.higherIsBetter && usersCard > lastPlayedCard ) {
                            // valid
                            console.log("valid");
                        } else if (user.higherIsBetter && usersCard < lastPlayedCard ) {
                            playable = false; // not valid
                            alert("Higher is better. You need to play a higher hand than what was just played.");
                        } else if (!user.higherIsBetter && usersCard > lastPlayedCard ) {
                            playable = false; // not valid
                            alert("Lower is better. You need to play a lower hand than what was just played.");
                        } else if (!user.higherIsBetter && usersCard < lastPlayedCard ) {
                            // valid
                            console.log("also valid");
                        } else if (usersCard === lastPlayedCard) {
                            console.log("Last foe: " + lastFoe);
                            user.isBattle_toServ = ["T", lastFoe]; //set flag to indicate battle order of play
                            alert("BATTLE!"); // valid, BATTLE
                        }
                    } else if (user.cardSelectedStack.length < lastPlay.length) {
                        playable = false; // not valid
                        alert("Its a Derby. You need to play more cards!");
                    } else if (user.cardSelectedStack.length > lastPlay.length && lastPlay.length > 1 ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && user.higherIsBetter && usersCard >= lastPlayedCard ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && !user.higherIsBetter && usersCard <= lastPlayedCard) {
                        console.log("derbs");
                        if (usersCard === lastPlayedCard) {
                            user.isSandwich_toServ = ["T", lastFoe];
                            alert("SANDWICH! And a DERBY!");
                        } else {
                            //valid
                        }
                    }

                    if (playable && user.cardSelectedStack.length > 1) {
                        user.isDerby_toServ = true; //set flag to indicate derby order of play
                        console.log("set isDerby to TRUE");
                        alert("DERBY!");
                    } else {
                        console.log(user.cardSelectedStack.length);
                        alert(playable);
                    }
                }
            }
        } else { //cards played were not all the same value
            playable = false; // not valid
            alert("Either you didn't select a card/cards or you tried to play different types of cards!");
        }

        if (playable) {
            removeSelectedFromHand("");
            user.playedMove_toServ = [user.cardSelectedStack_toServ, 'play', user.username]; //going to serv
            resetSelected(); //remove cards from cardSelectedStack after action
            user.hasPlayed = true;
            user.stillIn = true;
            //clearTimeout(timeoutVar);
            //send user.whatPlayed_toServer to server
            //...
        }
    } else {
        //cant play bc not your turn...
    }
}


//makes sure all cards selected are the same
function allSame() {
    let allSame = true;
    for (let i = 1; i < user.cardSelectedStack.length; i++) {
        let prevCard = user.cardSelectedStack[i-1].split("_")[3].substr(0, user.cardSelectedStack[i-1].split("_")[3].length - 1); //card value
        let curCard = user.cardSelectedStack[i].split("_")[3].substr(0, user.cardSelectedStack[i].split("_")[3].length - 1); //card value
        if (prevCard !== curCard && !(prevCard === '14' || curCard === '14') ) { //joker can be any card
            allSame = false;
            break;
        }
    }
    return allSame
}


//displays folded cards on pile, hill only happen/appear if user is still in and its not a Derby
function fold() {
    if (user.yourTurn) { //display number of selected cards folded in pile and remove cards from hand
        removeSelectedFromHand(""); //removes card from hand
        user.playedMove_toServ = [user.cardSelectedStack_toServ, 'fold', user.username];
        resetSelected(); //remove cards from cardSelectedStack after action
        user.stillIn = false; //out of round
        user.hasPlayed = true;
        //clearTimeout(timeoutVar); //stop timeout
    } else {
        //its not your turn so cant fold...
    }
}


//player ran out of time so auto play for them: if Derby => pass, otherwise => fold
function autoPlay() {
    if (user.yourTurn) {
        if (user.cardPile[0][0][0].length > 1) { //is Derby so pass
            //user.cardPile.unshift([[], 'pass', user.username]); //send this to server
            user.playedMove_toServ = [[], 'pass', user.username];
            user.stillIn = true; //out of round
        } else { //fold
            let randomCardNum = Math.floor((Math.random() * user.hand.length));
            removeSelectedFromHand(randomCardNum); //removes card from hand given hand index
            user.playedMove_toServ = [[user.hand[randomCardNum].split('_')[2]], 'fold', user.username];
            user.hand.splice(randomCardNum, 1); //remove card from hand
            user.stillIn = false; //out of round
        }
        user.hasPlayed = true;
        resetSelected_AUTO(); //remove cards from cardSelectedStack after action
        alert('Auto Played. You ran out of time.');
    } else {
        //its not your turn so cant autoplay...
    }
}


function nine() {
    let isHigher = user.higherIsBetter
    if (user.yourTurn) {
        let lastPlay = '';
        for (let i = 0; i < user.cardPile.length; i++) {
            if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                lastPlay = user.cardPile[i][0];
                break;
            }
        }
        if (lastPlay === '' || lastPlay.length === 1) { //not a derby
            if (isHigher) {
                document.getElementById("value").innerHTML = "Lower is Better";
                isHigher = "F";
            } else {
                document.getElementById("value").innerHTML = "Higher is Better";
                isHigher = "T";
            }
            removeSelectedFromHand(""); //removes card from hand (only card selected)
            user.playedMove_toServ = [[isHigher], 'wild', user.username ];
            resetSelected(); //remove cards from cardSelectedStack and hand array after action
            document.getElementById("nineButton").style.display = "none";
            user.stillIn = true; //out of round
            user.hasPlayed = true;
            //clearTimeout(timeoutVar);
        } else {
            alert("9 is NOT PLAYABLE, its a DERBY...");
            console.log("9 is NOT PLAYABLE, its a DERBY...");
            //currently is a derby so cant play a nine bc its a single card, cant play more than 1 nine either
        }
    } else {
        //cant play bc not your turn...
    }
}


//display card images of hand, add event listener for selecting cards
function setHand() {
    document.getElementById("hand_R").remove(); //reset hand each time
    let tr_ = document.createElement('tr');
    tr_.id = "hand_R";
    document.getElementById("hand_T").appendChild(tr_);
    //found ourself in the list, now create divs with imgs for our hand
    for(let j = 0; j < user.hand.length; j++) { //loop thru players hand list
        let td_ = document.createElement("td");
        let div_ = document.createElement("div");
        div_.style.backgroundColor = "white";
        div_.style.width = "90px";
        div_.style.height = "150px";
        div_.style.color = "white";
        div_.style.textAlign = "center";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "10px";
        let card_IMG = document.createElement("IMG");
        card_IMG.setAttribute("src", `/images/${user.hand[j]}.png`);
        card_IMG.setAttribute("width", "80");
        card_IMG.setAttribute("height", "120");
        card_IMG.style.padding = "0px 0px 0px 0px";
        card_IMG.style.margin = "10px 0px 0px 0px";
        card_IMG.id = `hand_${j}_${user.hand[j]}`;
        div_.id = `div_hand_${j}_${user.hand[j]}`;
        card_IMG.addEventListener("click", function(){cardsSelected(card_IMG.id, "")} );
        document.getElementById("hand_R").appendChild(td_).appendChild(div_).appendChild(card_IMG);
        if (user.hand[j] === "14j") {
            createMenu(div_);
        }
    }
}

function createMenu(div_) {
    let arr = [
            {val : "2s", text: '2'},
            {val : "3h", text: '3'},
            {val : "4d", text: '4'},
            {val : "5c", text: '5'},
            {val : "6s", text: '6'},
            {val : "7h", text: '7'},
            {val : "8d", text: '8'},
            {val : "9c", text: '9'},
            {val : "10s", text: '10'},
            {val : "11h", text: 'Jack'},
            {val : "12d", text: 'Queen'},
            {val : "13c", text: 'King'},
            {val : "69", text: 'Rotten Egg'},
        ];

        let sel = $('<select>').appendTo(div_);
        $(arr).each(function() {
            sel.append($("<option>").attr('value',this.val).text(this.text));
        });

        sel.on("change", function(event) {
            console.log("change . . .");
            let option_text = $(this).children("option:selected").text();
            let option_val = $(this).children("option:selected").val();
            //the whole point here is that we are re-assigning the div and img
            //ids to new ids so they represent a specific val instead of wild
            let img_id = $(this).parent().children(0).get(0).id;
            document.getElementById("h1").innerHTML = option_val;
            let l = img_id.split("_")[2].length;
            let new_id = img_id.substr(0, img_id.length - l) + option_val; //grabs everything but orig hand val, and concats new val
            document.getElementById(img_id).id = new_id; //set divs id to the new id so it
            document.getElementById( "div_" + img_id ).id = "div_" + new_id; //set divs id to the new id so it
            cardsSelected(new_id, img_id)
        });
        //set div and img ids to have val "2s" as is in menu initially
        let img_ID = div_.id.substr(4); //gets img id
        let l = img_ID.split("_")[2].length;
        let new_id = img_ID.substr(0, img_ID.length - l) + "2s"; //grabs everything but orig hand val, and concats new val
        document.getElementById(img_ID).id = new_id; //set divs id to the new id so it
        document.getElementById(div_.id).id = "div_" + new_id; //set divs id to the new id so it
        document.getElementById("h1").innerHTML = (document.getElementById(new_id).id).split("_")[2];
}


//highlights and unhighlights cards as they are clicked on
//param is the img id of the img card clicked on
//shows nine wild button if selection is just a nine
//params: clicked-on/new id, old wild id   :  the second param is only a string if
//the card is a wild card and the client changes the menu option while the card
//is selected, so have to change the id instead of a push or pop
function cardsSelected(img_ID, old_ID){
    document.getElementById("nineButton").style.display = "none";
    let div_ID = 'div_' + img_ID;
    let img = img_ID.split("_")[2]; //grabs just the img
    let d = document.getElementById(div_ID);
    let pos = user.cardSelectedStack.indexOf(div_ID);
    if (old_ID === "") { //a direct string change is not needed, push or pop is needed
        if ( pos >= 0 ) { //if the id is in the array, its already selected, so UNhighlight it
            if (div_ID.indexOf('9', 10) >= 0 && user.cardSelectedStack.length === 1 ) { //selected card was a 9, 12 is for '9' past 12 index
                document.getElementById("nineButton").style.display = "none";
            }
            d.style.backgroundColor = "white";
            user.cardSelectedStack.splice(pos, 1);
            user.cardSelectedStack_toServ.splice(pos, 1); //has same functionality as cardSelectedStack
        } else { //if its not in the array then Highlight the card and add it to the array
            if (div_ID.indexOf('9', 10) >= 0 && user.cardSelectedStack.length === 0) { //only selected card is a 9
                document.getElementById("nineButton").style.display = "block";
            }
            d.style.backgroundColor = "blue";
            user.cardSelectedStack.push(div_ID);
            user.cardSelectedStack_toServ.push(img);
        }
        if (user.cardSelectedStack.length > 1) {
            document.getElementById("nineButton").style.display = "none";
        } else if (user.cardSelectedStack.length === 1 && user.cardSelectedStack[0].indexOf('9', 10) >= 0 ) {
            document.getElementById("nineButton").style.display = "block";
        }
    } else { //find and change the old id to the new id : joker menu is changed while its selected
        pos = user.cardSelectedStack.indexOf("div_" + old_ID);
        user.cardSelectedStack[pos] = div_ID;
        user.cardSelectedStack_toServ[pos] = img;
    }
}


//sets the background color of all selected cards back to white
//clears the user.cardSelectedStack back to empty []
//removes played cards from the users hand array
//for once a user plays his selected cards, want to reset
function removeSelectedFromHand(ind) {
    if (ind === "") {
        for (let i = 0; i < user.cardSelectedStack.length; i++) {
            document.getElementById(user.cardSelectedStack[i]).remove(); //removes card from hand
        }
    } else {
        document.getElementById( "div_hand_" + ind + "_" + user.hand[ind]).remove();
    }
}


function resetSelected() {
    let tmp = user.hand;
    user.hand_toServ = tmp; //dont touch the hand, make a copy and send that to serv, protect against race conditions
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        user.hand_toServ.splice( user.hand_toServ.indexOf(user.cardSelectedStack[i].split("_")[3]), 1); //remove card from users hand, [2] grabs the index in hand array
    }
    user.hand = user.hand_toServ; //gets rid of cards from hand / update hand
    user.cardSelectedStack = []; //reset
    user.cardSelectedStack_toServ = []; //reset
}

//resets when auto play occurs
function resetSelected_AUTO() {
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        document.getElementById( user.cardSelectedStack[i] ).style.backgroundColor = "white";
    }
    //need to remove auto played card from hand in method auto was called in
    user.cardSelectedStack = []; //reset
    user.cardSelectedStack_toServ = []; //reset
}

//clears div img card pile
function resetCardPile() {
    document.getElementById('cardPileRow').remove(); //remove cardPile
    let tr_ = document.createElement('tr');
    tr_.id = "cardPileRow";
    document.getElementById('cardPile_T').appendChild(tr_);
}

//after each play/on the incoming server to client update, displays last played card on top of pile
function renderLastPlayed(last) {
    if (last[1] === 'play') { //create 1 dive that will be the background for however many cards were played each time
        let r1 = Math.floor((Math.random() * 255));
        let r2 = Math.floor((Math.random() * 255));
        let r3 = Math.floor((Math.random() * 255));
        let td_ = document.createElement("td");
        let div_ = document.createElement("div");
        div_.style.backgroundColor = "rgb("+ r1 +", "+ r2 +", "+ r3 +")";
        //div_.className = "cardPileDivs";
        div_.style.borderRadius = "20px";
        div_.style.padding = "20px 10px 10px 10px";
        div_.style.margin = "10px 5px 10px 5px";
        div_.style.color = "white";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "20px";
        td_.appendChild(div_);
        for(let j = 0; j < last[0].length; j++) {
            let card_IMG = document.createElement("IMG");
            card_IMG.setAttribute("src", `/images/${ last[0][j] }.png`);
            card_IMG.setAttribute("width", "80");
            card_IMG.setAttribute("height", "120");
            div_.appendChild(card_IMG);
        }
        let pileRow = document.getElementById("cardPileRow");
        pileRow.insertBefore(td_, pileRow.firstChild);
        let p = document.createElement('P');
        let t = document.createTextNode(last[2]);
        p.className = "pInDiv";
        p.appendChild(t);
        div_.appendChild(p);
    } else if (last[1] === 'wild') {
        let wcard = "wild_H.jpg";
        if (!user.higherIsBetter) {
            wcard = "wild_L.jpg";
            console.log("wild_L.jpg");
        }
        let r1 = Math.floor((Math.random() * 255));
        let r2 = Math.floor((Math.random() * 255));
        let r3 = Math.floor((Math.random() * 255));
        let td_ = document.createElement("td");
        let div_ = document.createElement("div");
        div_.style.backgroundColor = "rgb("+ r1 +", "+ r2 +", "+ r3 +")";
        //div_.className = "cardPileDivs";
        div_.style.borderRadius = "20px";
        div_.style.padding = "20px 10px 10px 10px";
        div_.style.margin = "10px 5px 10px 5px";
        div_.style.color = "white";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "20px";
        let card_IMG = document.createElement("IMG");
        card_IMG.setAttribute("src", `/images/${wcard}`);
        card_IMG.setAttribute("width", "80");
        card_IMG.setAttribute("height", "120");
        let pileRow = document.getElementById("cardPileRow");
        td_.appendChild(div_);
        div_.appendChild(card_IMG);
        pileRow.insertBefore(td_ , pileRow.firstChild);
        let p = document.createElement('P');
        let t = document.createTextNode(last[2]);
        p.className = "pInDiv";
        p.appendChild(t);
        div_.appendChild(p);
        //document.getElementById("cardPileRow").appendChild(td_).appendChild(div_).appendChild(card_IMG);
    } else if (last[1] === 'fold') { //create 1 dive that will be the background for however many cards were played each time
        let r1 = Math.floor((Math.random() * 255));
        let r2 = Math.floor((Math.random() * 255));
        let r3 = Math.floor((Math.random() * 255));
        let td_ = document.createElement("td");
        let div_ = document.createElement("div");
        div_.style.backgroundColor = "rgb("+ r1 +", "+ r2 +", "+ r3 +")";
        //div_.className = "cardPileDivs";
        div_.style.borderRadius = "20px";
        div_.style.padding = "20px 10px 10px 10px";
        div_.style.margin = "10px 5px 10px 5px";
        div_.style.color = "white";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "20px";
        td_.appendChild(div_);
        for(let j = 0; j < last[0].length; j++) {
            let card_IMG = document.createElement("IMG");
            card_IMG.setAttribute("src", `/images/fold.png`);
            card_IMG.setAttribute("width", "80");
            card_IMG.setAttribute("height", "120");
            div_.appendChild(card_IMG);
        }
        let pileRow = document.getElementById("cardPileRow");
        pileRow.insertBefore(td_ , pileRow.firstChild);
        let p = document.createElement('P');
        let t = document.createTextNode(last[2]);
        p.className = "pInDiv";
        p.appendChild(t);
        div_.appendChild(p);
    } else if (last[1] === 'battle') { // needs work!
        console.log("set battle in pile");
        let B_td_ = document.createElement("td");
        let B_div_ = document.createElement("div");
        B_div_.style.backgroundColor = "deepskyblue";
        //B_div_.className = "cardPileDivs";
        B_div_.style.borderRadius = "20px";
        B_div_.style.padding = "20px 10px 10px 10px";
        B_div_.style.margin = "10px 5px 10px 5px";
        B_div_.style.color = "white";
        B_div_.style.verticalAlign = "middle";
        B_div_.style.lineHeight = "20px";
        let pileRow = document.getElementById("cardPileRow");
        pileRow.insertBefore(B_td_, pileRow.firstChild);
        B_td_.appendChild(B_div_);
        let B_tabl = document.createElement("TABLE");
        let B_row = document.createElement("TR");
        B_div_.appendChild(B_tabl);
        B_tabl.appendChild(B_row);
        for(let i = 0; i < last[0].length; i++) { // loops thru battle stack in last played move[0]
            let r1 = Math.floor((Math.random() * 255));
            let r2 = Math.floor((Math.random() * 255));
            let r3 = Math.floor((Math.random() * 255));
            let td_ = document.createElement("td");
            let div_ = document.createElement("div");
            div_.style.backgroundColor = "rgb("+ r1 +", "+ r2 +", "+ r3 +")";
            //div_.className = "cardPileDivs";
            div_.style.borderRadius = "20px";
            div_.style.padding = "20px 10px 10px 10px";
            div_.style.margin = "10px 5px 10px 5px";
            div_.style.color = "white";
            div_.style.verticalAlign = "middle";
            div_.style.lineHeight = "20px";
            B_row.appendChild(td_);
            td_.appendChild(div_);
            for(let j = 0; j < last[0][i][0].length; j++) { //if multiple cards were played by a single player
                let card_IMG = document.createElement("IMG");
                card_IMG.setAttribute("src", `/images/${ last[0][i][0][j] }.png`);
                card_IMG.setAttribute("width", "80");
                card_IMG.setAttribute("height", "120");
                div_.appendChild(card_IMG);
            }
            let p = document.createElement('P');
            let txt = document.createTextNode(last[0][i][2]); //who played the card
            p.className = "pInDiv";
            p.appendChild(txt);
            div_.appendChild(p);
        }
        let B_p = document.createElement('P');
        let B_txt = document.createTextNode("Battle");
        B_p.className = "pInDiv";
        B_p.appendChild(B_txt);
        B_div_.appendChild(B_p);
    }
    else if (last[1] === 'pass') {
        //render nothing because player passed
        //safs
    }
}
