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
        this.timerObj = {};
        this.chatList = [];
        this.end_round = "false";
    }
}

var lord = "asdfnsdafjknasdjkfnasdkjfasdnfnmbewmmkrnq";
var roomID = "asjnfkajsdfhnsdajkfnrfnreuhyrewoncjbas";
var user = new Player(localStorage.getItem('curUser')); // Retrieves from browser storage
//var timeoutVar = "";
//var keepUpdating = "" //an interval that continuously updates client with current game data

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
    document.getElementById("p1").innerHTML = user.username;
    let waitToStartGame_interv = setInterval(waitToStartGame, 1000);

    function waitToStartGame() {
        $.post('/getGameData',
            {
                roomID: roomID,
                user: user.username
            },
            function(data, status){
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
                document.getElementById("cardDeck").innerHTML = user.cardsInDeck; //display num cards left in deck
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
                    div_.innerHTML = key + "<br />" + "Cards: " + user.hand.length + "<br />" + "score: 0"; //players name and score
                    div_.id = "sb_" + key;
                    document.getElementById("peeps_R").appendChild(td_).appendChild(div_);
                }
                updateChatList(data.chatList);
                if (user.username === user.lord && !user.startGame) { //startgame button only appears for (lord) creator of room, once clicked will try and start game
                    document.getElementById('startGameButton').style.display = "block"; //display button
                }
                if (user.startGame) {
                    clearInterval(waitToStartGame_interv); //interval is stopped -> startGame is true -> everyone is here and lord pressed start button
                    setHand();
                    user.timerObj.keepUpdating = setInterval(playGame_keepUpdatingFromServer, 1000); //this starts game. goes every sec
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
            });
        document.getElementById('startGameButton').style.display = "none";
    } else {
        alert("Sorry, can't start until everyone is here.");
    }
}


//displays each players handSize, stillIn, yourTurn, score
function scoreboard(server_dict_varData) {
    for (let key in user.dict_varData) {
        //update paly typle box
        let pt_div = document.getElementById("playType");
        console.log("SB inner:: " + pt_div.innerHTML);
        console.log("is B :: " + user.isBattle);
        console.log("is D :: " + user.isDerby);
        console.log(user.dict_varData);
        console.log(server_dict_varData);
        if (!user.isBattle && !user.isDerby && pt_div.style.backgroundColor !== "limegreen") { //normal
            pt_div.style.backgroundColor = "limegreen";
            pt_div.innerHTML = "Normal";
        } else if (user.isBattle && pt_div.innerHTML !== "Battle!!") {
            pt_div.style.backgroundColor = "deepskyblue";
            pt_div.innerHTML = "Battle!!";
        } else if (user.isDerby && pt_div.innerHTML !== "Derby!") {
            pt_div.style.backgroundColor = "blueviolet";
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
        if (server_dict_varData[key][0] !== user.dict_varData[key][0] || server_dict_varData[key][3] !== user.dict_varData[key][3] ) {
            console.log("UPDATE cards score");
            let div_ = document.getElementById("sb_" + key);
            div_.innerHTML = key + "<br />" + "Cards: " + server_dict_varData[key][0] + "<br />" + "score: " + server_dict_varData[key][3]; //players name and score
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
            if (user.higherIsBetter !== server_data.higherIsBetter) { //only update if incoming flag is diff from users flag
                user.higherIsBetter = server_data.higherIsBetter;
                if (server_data.higherIsBetter) {
                    document.getElementById("value").innerHTML = "Higher";
                } else {
                    document.getElementById("value").innerHTML = "Lower";
                }
            }
            user.isBattle = server_data.isBattle;
            user.isDerby = server_data.isDerby;
            user.battleStack_Players = server_data.battleStack_Players;
            user.hand = server_data.hand; //update before setHand() below
            if (user.cardPile.length < server_data.cardPile.length) {
                console.log("updated cardPile");
                renderLastPlayed(server_data.cardPile[0]);
            }
            if (server_data.end_round[0] === "true" && user.end_round === "false" && server_data.gameOver[0] !== "T") { //if incoming data is diff then update
                console.log("Round Ended");
                endRound(server_data.end_round[1]);
            }
            user.cardPile = server_data.cardPile;
            scoreboard(server_data.dict_varData); // update displays of each players: handSize, stillIn, yourTurn, score
            user.dict_varData = server_data.dict_varData;
            user.yourTurn = server_data.dict_varData[user.username][2]; //updates if its your turn
            if (user.cardsInDeck !== server_data.cardsInDeck) {
                user.cardsInDeck = server_data.cardsInDeck;
                document.getElementById("cardDeck").innerHTML = user.cardsInDeck; //display num cards left in deck
            }
            updateChatList(server_data.chatList);
            //user.gameOver = server_data.gameOver;
            if (server_data.gameOver[0] === "T") {
                clearInterval(user.timerObj.keepUpdating);
                alert("Game Over!");
                document.getElementById("round_winner").innerHTML = server_data.gameOver[1] + " WON!!! To play again, exit and create another room.";
                document.getElementById("round_winner").style.backgroundColor = "gold";
                document.getElementById("round_title").style.backgroundColor = "gold";
            } else {
                playGame_afterServerUpdate();
            }
    });
}


//continuous functionality of client if its his turn or not
function playGame_afterServerUpdate() { //called every second
    if(user.end_round === "false") { //instead of using a while loop, use an interval
        //toggle display of action buttons if user is still in or not
        if (user.stillIn) {
            document.getElementById("foldButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
            document.getElementById("playButton").style.display = "none";
            document.getElementById("battleButton").style.display = "block";

            if (user.yourTurn) {
                if (user.yourTurn_FirstCall) { //the first and only time this will execute when its your turn
                    // - - - TIMER STUFF ***
                    //start timer obj
                    user.timerObj.timeoutNum = 31000; //31 seconds to play
                    user.timerObj.startTimeMS = Math.round( ((new Date()).getTime())/1000 );
                    //user.timerObj.timeoutVar = setTimeout(autoPlay, user.timerObj.timeoutNum); //31 seconds
                    // - - - TIMER STUFF ***
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
                    //if (user.isDerby) {
                    //    document.getElementById("passButton").style.display = "block";
                    //    document.getElementById("foldButton").style.display = "none";
                    //}
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

                    let divClock = document.getElementById("clock");

                    if(!user.hasPlayed) { //while user has not played, should start as false

                        // - - - TIMER STUFF ***
                        let curTime = Math.round( ((new Date()).getTime())/1000 ); //user.timerObj.timeoutVar - ( (new Date()).getTime() - user.timerObj.startTimeMS);
                        let passedTime = Math.round( curTime - user.timerObj.startTimeMS );
                        let timeLeft = Math.round( (user.timerObj.timeoutNum / 1000) - passedTime ); //in sec

                        if (timeLeft >= 20) {
                            divClock.style.backgroundColor = "green";
                            divClock.innerHTML = timeLeft;
                        } else if (timeLeft < 20 && timeLeft >= 10) {
                            divClock.style.backgroundColor = "orange";
                            divClock.innerHTML = timeLeft;
                        } else if (timeLeft < 10 && timeLeft >= 0) {
                            divClock.style.backgroundColor = "red";
                            divClock.innerHTML = timeLeft;
                        } else if (timeLeft < 0) {
                            console.log("- NEG ");
                            //clearTimeout(user.timerObj.timeoutVar); //stop timer
                            alert("Auto played, you ran out of time.");
                            divClock.style.backgroundColor = "white";
                            divClock.innerHTML = 30;
                            autoPlay();
                        }
                        // - - - TIMER STUFF ***

                    } else { //played
                        console.log("played!");
                        if (divClock.style.backgroundColor !== "white" || divClock.innerHTML !== 30) { // reset clock
                            console.log("reset clock display");
                            divClock.style.backgroundColor = "white";
                            divClock.innerHTML = 30;
                        }
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
                        //once played, send data to server, only after your turn
                        $.post('/turnOver_update_clientToServer',
                            {
                                user_data: post_JSON
                            },
                            function(data, status) {
                                user.isBattle_toServ = ["F", ""];
                                user.isSandwich_toServ = ["F", ""];
                        });
                    }
                } else { //ran out of cards...
                    user.stillIn = false;
                    user.yourTurn = false;
                    console.log("Ran Out Of Cards...");
                }
            } else { //not your turn so wait
                if (user.battleStack_Players.indexOf(user.username) >= 0) { //if user is already playing in a battle, remove the battle button
                    document.getElementById("battleButton").style.display = "none";
                } else {
                    document.getElementById("battleButton").style.display = "block";
                }
            }
        } else { //not in round
            document.getElementById("foldButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
            document.getElementById("playButton").style.display = "none";
            document.getElementById("battleButton").style.display = "none";
            document.getElementById("nineButton").style.display = "none";
        }
    } else if (user.gameOver[0] === "T") { //game is over
        console.log("Game is over!");
        //alert("GAME OVER! Winner: " + user.gameOver[1]);
    } else {
        console.log("round over, waiting...");
        //waiting 10 seconds for peeps to see who won/how because round is over
    }
}


//makes sure all cards selected are the same when action button like play or battle is pressed
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


//only seen when you are in but its not your turn but could be if you came in to battle or sandwhich someone
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
                    alert("SANDWICH! ... DERBY!");
                }
                if (playable && user.cardSelectedStack.length > 1) {
                    user.isDerby_toServ = true; //set flag to indicate derby order of play
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
        removeSelectedFromHand("");
        user.playedMove_toServ = [user.cardSelectedStack_toServ, 'play', user.username]; //going to serv
        resetSelected(); //remove cards from cardSelectedStack after action
        user.stillIn = true;
        user.yourTurn = true; //reset turn bool
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
        //once played, send data to server, only after your turn
        $.post('/turnOver_update_clientToServer',
            {
                user_data: post_JSON
            },
            function(data, status) {
                user.isBattle_toServ = ["F", ""];
                user.isSandwich_toServ = ["F", ""];
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

                if (user.cardPile.length === 0) { //(lastPlay === '') user is first to play this round so as long as user doesn't play more than 1 card he can play anything
                    if (user.cardSelectedStack.length > 1) { //cant start with a derby
                        playable = false;
                        alert("Can't start a round by playing multiple cards (Derby).");
                    }
                } else if (lastPlay !== '') { //someone played before user, must beat that card(s)
                    let usersCard = user.cardSelectedStack[0].split("_")[3].substr(0, user.cardSelectedStack[0].split("_")[3].length - 1); //card value
                    let lastPlayedCard = lastPlay[0].substr(0, lastPlay[0].length - 1); //card value
                    usersCard = parseInt(usersCard); //was string
                    lastPlayedCard = parseInt(lastPlayedCard);  //was string

                    if (user.cardSelectedStack.length >= lastPlay.length && usersCard === 15) {
                        //valid, ace/aces were played
                    } else if (user.cardSelectedStack.length === lastPlay.length) {
                        if (user.higherIsBetter && usersCard > lastPlayedCard ) {
                            // valid
                        } else if (user.higherIsBetter && usersCard < lastPlayedCard ) {
                            playable = false; // not valid
                            alert("Higher is better. You need to play a higher hand than what was just played.");
                        } else if (!user.higherIsBetter && usersCard > lastPlayedCard ) {
                            playable = false; // not valid
                            alert("Lower is better. You need to play a lower hand than what was just played.");
                        } else if (!user.higherIsBetter && usersCard < lastPlayedCard ) {
                            // valid
                        } else if (usersCard === lastPlayedCard) {
                            user.isBattle_toServ = ["T", lastFoe]; //set flag to indicate battle order of play
                            alert("BATTLE!"); // valid, BATTLE
                        }
                    } else if (user.cardSelectedStack.length < lastPlay.length) {
                        playable = false; // not valid
                        alert("Its a Derby. You need to play more cards!");
                    } else if (user.cardSelectedStack.length > lastPlay.length && lastPlay.length > 1 ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && user.higherIsBetter && usersCard >= lastPlayedCard ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && !user.higherIsBetter && usersCard <= lastPlayedCard) {
                        if (usersCard === lastPlayedCard) {
                            user.isSandwich_toServ = ["T", lastFoe];
                            alert("SANDWICH! And a DERBY!");
                        } else {
                            //valid
                        }
                    }
                    if (playable && user.cardSelectedStack.length > 1) {
                        user.isDerby_toServ = true; //set flag to indicate derby order of play
                        if (!user.isDerby) {
                            alert("DERBY!");
                        }
                    } else {
                        //derby is false ... user.isDerby_toServ = false;
                    }
                } else {
                    //can play anything. ex. wild 9 to start, then someone can play anything they want
                }
            }
        } else { //cards played were not all the same value
            playable = false; // not valid
            alert("Either you didn't select a card/cards or you tried to play different types of cards!");
        }
        if (playable) {
            //clearTimeout(user.timerObj.timeoutVar); //stop timer
            removeSelectedFromHand("");
            user.playedMove_toServ = [user.cardSelectedStack_toServ, 'play', user.username]; //going to serv
            resetSelected(); //remove cards from cardSelectedStack after action
            user.hasPlayed = true;
            user.stillIn = true;
        }
    } else {
        //cant play bc not your turn...
    }
}


function pass() {
    if (user.isDerby) {
        //clearTimeout(user.timerObj.timeoutVar); //stop timer
        user.playedMove_toServ = [[], 'pass', user.username];
        resetSelected(); //remove cards from cardSelectedStack after action
        user.hasPlayed = true;
        user.stillIn = true;
        user.yourTurn = false; //reset turn bool
    }
}


//displays folded cards on pile, hill only happen/appear if user is still in and its not a Derby
function fold() {
    console.log("clicked fold");
    user.playedMove_toServ = [user.cardSelectedStack_toServ, 'fold', user.username];
    //clearTimeout(user.timerObj.timeoutVar); //stop timer
    removeSelectedFromHand(""); //removes card from hand
    resetSelected(); //remove cards from cardSelectedStack after action
    //user.stillIn = false; //out of round
    user.hasPlayed = true;
}


//if 9 is chossen to be played as a wild card 9
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
                document.getElementById("value").innerHTML = "Lower";
                isHigher = "F";
            } else {
                document.getElementById("value").innerHTML = "Higher";
                isHigher = "T";
            }
            //clearTimeout(user.timerObj.timeoutVar); //stop timer
            removeSelectedFromHand(""); //removes card from hand (only card selected)
            user.playedMove_toServ = [[isHigher], 'wild', user.username];
            resetSelected(); //remove cards from cardSelectedStack and hand array after action
            document.getElementById("nineButton").style.display = "none";
            user.stillIn = true; //out of round
            user.hasPlayed = true;
        } else {
            alert("9 is NOT PLAYABLE, its a DERBY...");
            //currently is a derby so cant play a nine bc its a single card, cant play more than 1 nine either
        }
    } else {
        //cant play bc not your turn...
    }
}


//player ran out of time so auto play for them: if Derby => pass, otherwise => fold
function autoPlay() {
    console.log("In Auto Play");
    if (user.isDerby) { //is Derby so pass
        user.playedMove_toServ = [[], 'pass', user.username];
        user.stillIn = true; //out of round
        console.log("auto passed...");
    } else { //fold because its normal play
        let randomCardNum = Math.floor((Math.random() * user.hand.length));
        user.playedMove_toServ = [[user.hand[randomCardNum]], 'fold', user.username]; //if it chose a joker, joker will be set to a 2
        resetSelected_AUTO(); //remove cards from cardSelectedStack after action
        removeSelectedFromHand(randomCardNum); //removes div/img from hand display given hand index and removes card from hand array []
        //user.stillIn = false; //out of round
    }
    user.hasPlayed = true;
    //alert('Auto Played. You ran out of time.');
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
        //div_.style.width = "75px"; //90
        //div_.style.height = "110px"; //150
        div_.style.color = "white";
        div_.style.textAlign = "center";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "10px";
        let card_IMG = document.createElement("IMG");
        card_IMG.setAttribute("src", `/images/${user.hand[j]}.png`);
        card_IMG.setAttribute("width", "65"); //80
        card_IMG.setAttribute("height", "92"); //120
        card_IMG.style.padding = "0px 0px 0px 0px";
        card_IMG.style.margin = "5px 5px 5px 5px";
        card_IMG.id = `hand_${j}_${user.hand[j]}`; // want to add "j" num into id because with multiple...
        div_.id = `div_hand_${j}_${user.hand[j]}`; // decks could have same cards in hand = same ids = no no
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
            {val : "9c", text: '9'}, //9c
            {val : "10s", text: '10'},
            {val : "11h", text: 'Jack'},
            {val : "12d", text: 'Queen'},
            {val : "13c", text: 'King'},
            {val : "69", text: 'Rotten Egg'}, //if folded, whoever wins round doesn't get the points
        ];

        let sel = $('<select>').appendTo(div_);
        $(arr).each(function() {
            sel.append($("<option>").attr('value',this.val).text(this.text));
        });

        sel.on("change", function(event) {
            console.log("CHANGE ::");
            //let option_text = $(this).children("option:selected").text();
            //the whole point here is that we are re-assigning the div and img
            //ids to new ids so they represent a specific val/card instead of wild
            let option_val = $(this).children("option:selected").val();
            let img_id = $(this).parent().children(0).get(0).id;
            let l = img_id.split("_")[2].length;
            console.log(l);
            console.log( img_id.substr(0, img_id.length - l) );
            let new_id = img_id.substr(0, img_id.length - l) + "_" + option_val;
            console.log("before : " + img_id);
            document.getElementById(img_id).id = new_id; //set divs id to the new id so it
            document.getElementById( "div_" + img_id ).id = "div_" + new_id; //set divs id to the new id so it
            console.log("option_val : " + option_val);
            console.log("after : " + new_id);
            console.log("- - - ... done CHANGE");
            cardsSelected(new_id, img_id);
        });
        //set div and img ids to have val "2s" as is in menu initially
        let img_ID = div_.id.substr(4); //gets img id, does not have "div_" in it
        document.getElementById(img_ID).id = img_ID + "_2s"; //set img id to the new id so it
        document.getElementById(div_.id).id = div_.id + "_2s"; //set divs id to the new id so it
}


//highlights and unhighlights cards as they are clicked on
//param is the img id of the img card clicked on
//shows nine wild button if selection is just a nine
//params: clicked-on/new id, old wild id   :  the second param is only a string if
//the card is a wild card and the client changes the menu option while the card
//is selected, so have to change the id instead of a push or pop
// ex div joker id: div_hand_12_14j_2s
function cardsSelected(img_ID, old_ID){
    console.log("CSS BEFORE: ");
    console.log(user.cardSelectedStack);
    console.log(user.cardSelectedStack_toServ);
    document.getElementById("nineButton").style.display = "none";
    let div_ID = 'div_' + img_ID;
    let img = img_ID.split("_")[2]; //grabs just the img
    let d = document.getElementById(div_ID);
    let pos = user.cardSelectedStack.indexOf(div_ID);
    if (old_ID === "") { //a direct string change is not needed, push or pop is needed
        if ( pos >= 0 ) { //if the id is in the array, its already selected, so UNhighlight it
            if (img.indexOf('9', 0) >= 0 && user.cardSelectedStack.length === 1 ) { //selected card was a 9 not from joker
                document.getElementById("nineButton").style.display = "none";
                console.log("9 wild gone...");
            }
            d.style.backgroundColor = "white";
            user.cardSelectedStack.splice(pos, 1);
            user.cardSelectedStack_toServ.splice(pos, 1); //has same functionality as cardSelectedStack
        } else { //if its not in the array then Highlight the card and add it to the array
            if (img.indexOf('9', 0) >= 0 && user.cardSelectedStack.length === 0) { //only selected card is a 9 not from joker
                document.getElementById("nineButton").style.display = "block";
                console.log("9 wild IN");
            }
            console.log(img);
            if (img === "14j") {
                console.log("JOKER!");
                user.cardSelectedStack_toServ.push(div_ID.split("_")[4]); //img from joker
            } else {
                console.log("not a JOKER");
                user.cardSelectedStack_toServ.push(img); //non joker img
            }
            d.style.backgroundColor = "blue";
            user.cardSelectedStack.push(div_ID);
        }
        if (user.cardSelectedStack.length > 1) {
            document.getElementById("nineButton").style.display = "none";
            console.log("9 wild gone...");
        } else if (user.cardSelectedStack.length === 1 && user.cardSelectedStack[0].split("_")[3].indexOf('9', 0) >= 0) {
            //only selected card is a 9 (not from joker)
            document.getElementById("nineButton").style.display = "block";
            console.log("9 wild IN");
        }
    } else { //here bc card is joker options change. Find and change the old joker id to new id
        pos = user.cardSelectedStack.indexOf("div_" + old_ID); //pos of old joker id
        if (pos >= 0) {
            user.cardSelectedStack[pos] = div_ID; //replace with new id
            user.cardSelectedStack_toServ[pos] = div_ID.split("_")[4]; //new joker value
        }
    }
    console.log("CSS After: ");
    console.log(user.cardSelectedStack);
    console.log(user.cardSelectedStack_toServ);
    console.log("- - - ...");
}


//resets when auto play occurs because no selected cards where necesarily played, a rand card is chosen to fold
function resetSelected_AUTO() {
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        document.getElementById( user.cardSelectedStack[i] ).style.backgroundColor = "white";
    }
    user.cardSelectedStack = []; //reset
    user.cardSelectedStack_toServ = []; //reset
}

//sets the background color of all selected cards back to white
//clears the user.cardSelectedStack back to empty []
//removes played cards from the users hand array
//for once a user plays his selected cards, want to reset
//auto_play gives a param index so can delete that card from hand array and the div/img from hand display
function removeSelectedFromHand(ind) {
    if (ind === "") {
        for (let i = 0; i < user.cardSelectedStack.length; i++) {
            document.getElementById(user.cardSelectedStack[i]).remove(); //removes card from hand
        }
    } else { //called by auto_play
        console.log("AUTO REM");
        console.log(user.hand_toServ);
        console.log(user.hand);
        console.log(user.hand_toServ);
        let id = document.getElementById("hand_R").children[ind].children[0].id; //div id
        document.getElementById("hand_R").children[ind].children[0].remove();
        user.hand.splice(ind, 1); //removes card from hand array
        user.hand_toServ = user.hand.slice(0); //dont touch the hand, make a copy and send that to serv, protect against race conditions
        console.log(user.hand);
        console.log(user.hand_toServ);
    }
    console.log("- - - ... end");
}


//updates user card hand array given what they played
function resetSelected() {
    user.hand_toServ = user.hand.slice(0); //dont touch the hand, make a copy and send that to serv, protect against race conditions
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        user.hand_toServ.splice( user.hand_toServ.indexOf(user.cardSelectedStack[i].split("_")[3]), 1); //remove card from users hand, [2] grabs the index in hand array
    }
    user.hand = user.hand_toServ.slice(0); //gets rid of cards from hand / update hand
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
            card_IMG.setAttribute("width", "65"); //80
            card_IMG.setAttribute("height", "92"); //120
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
        card_IMG.setAttribute("width", "65"); //80
        card_IMG.setAttribute("height", "92"); //120
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
        console.log("RENDER FOLD");
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
            card_IMG.setAttribute("width", "65"); //80
            card_IMG.setAttribute("height", "92"); //120
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
                card_IMG.setAttribute("width", "65"); //80
                card_IMG.setAttribute("height", "92"); //120
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

//when user sends a msg
function sendChatMessege(event, form) {
    event.preventDefault();
    if (form.msg.value !== "") {
        let chat_obj = {};
        chat_obj.roomID = roomID;
        chat_obj.user = user.username;
        chat_obj.msg = form.msg.value;
        let chat_JSON = JSON.stringify(chat_obj);
        document.getElementById("chat_form").msg.value = ""; //reset input box
        $.post('/chatRoom',
            {
                user_data: chat_JSON
            },
            function(data, status) {
        });
    }
}

//updates client chat list with incoming msgs
//incoming chat "lst" is only 10 msgs long
function updateChatList(lst) {
    if (user.chatList.length === 0 && lst.length > 0) { //just creating chat list
        user.chatList = lst;
        let chat_lst = document.getElementById("chat_list");
        for (let j = 0; j < lst.length; j++) {
            let x = document.createElement("LI");
            x.innerHTML = lst[j];
            x.className = "chat_li";
            chat_lst.appendChild(x);
        }
    } else if (user.chatList[0] !== lst[0]) { //client list already exists and needs to be updated (doesn't match servers list)
        let pos = 10; //max msgs allowed in chat lst
        for (let i = 1; i < lst.length; i++) {
            if (user.chatList[0] === lst[i]) { //find where lists match
                pos = i; //number of msgs to update/queue client side
                break;
            }
        }
        let chat_lst = document.getElementById("chat_list");
        for (let j = pos - 1; j >= 0; j--) {
            let x = document.createElement("LI");
            x.innerHTML = lst[j];
            x.className = "chat_li";
            chat_lst.insertBefore(x, chat_lst.firstChild);
            if (chat_lst.children.length > 10) {
                chat_lst.childNodes.item(10).remove();
            }
        }
        user.chatList = lst;
    } else {
        //they are same, no update needed.
    }
}

function endRound(winner) {
    user.end_round = "true";
    user.timerObj.endRound_timeout = setTimeout(newRound, 10000); //15 seconds
    console.log("newRound timeout set");
    document.getElementById("round_winner").innerHTML = winner + " won the round.";
    document.getElementById("round_winner").style.backgroundColor = "pink";
    document.getElementById("round_title").style.backgroundColor = "pink";

    document.getElementById("foldButton").style.display = "none";
    document.getElementById("passButton").style.display = "none";
    document.getElementById("playButton").style.display = "none";
    document.getElementById("battleButton").style.display = "none";
    document.getElementById("nineButton").style.display = "none";
}

function newRound() {
    console.log("New Round method");
    alert("New Round!");
    document.getElementById("round_winner").innerHTML = "";
    document.getElementById("round_title").style.backgroundColor = "#7F7C6A";
    document.getElementById("round_winner").style.backgroundColor = "#7F7C6A";
    user.isDerby_toServ = false;
    resetCardPile(); //resets card pile because round ended and incoming card pile is empty so user pile should be too
    setHand(); //can only refuel after a round is over.
    let newRound_obj = {};
    newRound_obj.roomID = roomID;
    let newRound_JSON = JSON.stringify(newRound_obj);
    $.post('/start_new_round',
        {
            user_data: newRound_JSON
        },
        function(data, status) {
            user.end_round = "false";
            console.log("Started New Round");
    });
}

//"Shutdown/deletion of room" : if lord leaves room, deletes room schema on mongodb
window.addEventListener('beforeunload', function(e) {
    if (user.username === user.lord) { //only the lord leaving can delete the room schema
        //console.log("Deleting room schema and leaving.");
        $.post('/deleteRoom',
            {
                roomID: roomID
            },
            function(data, status){
                console.log("Deleted!");
        });
    } else {
        //console.log("minion left...");
    }
});
