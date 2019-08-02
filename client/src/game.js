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
4.) Client does all move validation, Server does all other calculations upon receiving data from client (turns, score, dealing...)

so circle: server (data)-> client,    if clients turn/turn just finishes (data)-> server
*/

"use strict";

class Player { //keeps track of all the data
    constructor(username) {
        //nums and strings
        this.lord = "";
        this.username = username; //your username
        this.refuelNum = 0;
        this.score = 0; //how many cards have you won
        this.cardsInDeck = -1; //amount of cards still in the deck
        this.gameSize = -1;
        //arrays
        this.players = [];
        this.hand = []; //the cards in your hand. Clients hand only gets updated by server after a round is over. Client updates its own hand and sends update to server
        this.hand_fallback = []; //make a copy in case data was not sent to server so can reset hand back to last state
        this.cardSelectedStack = []; //cards selected in his hand (list of ids)
        this.cardSelectedStack_toServ = []; //same as cardSelectedStack but just img string, not entire dom id
        this.playedMove_toServ = []; //a tmp var that is used to send the played move of user to server
        this.cardPile = []; //playing pile an array of arrays, usually each is an array having a single card item, Derby items have multiple cards
        this.battleStack_Players = [];
        this.chatList = [];
        //this.roundLog = []; // [last round winner, his prev score, cards won in that round]
        //objects
        this.dict_varData = {}; // dict of users , user : [handSize, stillIn, yourTurn, score, sandwiched]
        this.timerObj = {};
        //bools
        this.yourTurn = false;
        this.startGame = false;
        this.higherIsBetter = true; //higher cards are better
        this.yourTurn_FirstCall = true; //keeps track of first time the interval is called during a players turn
        this.hasPlayed = false; //user has played or not
        this.isBattle = false;
        this.isDerby = false;
        this.isDerby_toServ = false;
        this.isBattle_toServ = ["F", ""];
        this.isSandwich_toServ = ["F", "", ""]; // [T/F, name, card val]
        this.end_round = "false";
        this.gameOver = ["F", ""];
    }
}

//initial variables used to set up game room
var lord = "asdfnsdafjknasdjkfnasdkjfasdnfnmbewmmkrnq";
var roomID = "asjnfkajsdfhnsdajkfnrfnreuhyrewoncjbas";
var user = new Player(localStorage.getItem('curUser')); // Retrieves from browser storage

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
    let waitToStartGame_interv = setInterval(waitToStartGame, 1000);

    function waitToStartGame() {
        $.post('/getGameData',
            {
                roomID: roomID,
                user: user.username
            },
            function(data, status){
                if (user.gameSize !== user.players.length) {
                    document.getElementById("p3").innerHTML = data.gameSize;
                    document.getElementById("p4").innerHTML = data.deckSize;
                    document.getElementById("p5").innerHTML = data.handSize;
                    document.getElementById("p6").innerHTML = data.refuelNum;
                    user.lord = data.lord;
                    user.players = data.players;
                    user.refuelNum = data.refuelNum;
                    user.gameSize = data.gameSize;
                    user.dict_varData = data.dict_varData;
                    document.getElementById("peeps_R").remove();
                    let tr_ = document.createElement('tr');
                    tr_.id = "peeps_R";
                    document.getElementById("peeps_T").appendChild(tr_);
                    for(let key in user.dict_varData) { //will create divs with every joined player's name
                        var td_ = document.createElement("td");
                        var div_ = document.createElement("div");
                        div_.style.backgroundColor = "green";
                        //div_.style.width = "100px";
                        div_.style.height = "70px";
                        div_.style.color = "black";
                        div_.style.textAlign = "center";
                        div_.style.verticalAlign = "middle";
                        div_.style.lineHeight = "20px";
                        div_.style.borderRadius = "15px";
                        div_.style.fontFamily = "geneva";
                        div_.style.paddingTop = "5px";
                        div_.style.paddingLeft = "8px";
                        div_.style.paddingRight = "8px";
                        div_.style.borderStyle = "solid";
                        div_.style.borderWidth = "2px";
                        div_.style.borderColor = "black";
                        div_.innerHTML = key + "<br />" + "Cards: " + user.hand.length + "<br />" + "score: 0"; //players name and score
                        div_.id = "sb_" + key;
                        document.getElementById("peeps_R").appendChild(td_).appendChild(div_);
                    }
                }

                user.startGame = data.startGame;
                user.hand = data.hand;
                user.cardsInDeck = data.deckSize;
                document.getElementById("cardDeck").innerHTML = user.cardsInDeck; //display num cards left in deck
                updateChatList(data.chatList);

                if (user.username === user.lord && !user.startGame) { //startgame button only appears for (lord) creator of room, once clicked will try and start game
                    document.getElementById('startGameButton').style.display = "block"; //display button
                }

                if (user.startGame) { //also init timer stuff
                    clearInterval(waitToStartGame_interv); //interval is stopped -> startGame is true -> everyone is here and lord pressed start button
                    setHand();
                    document.getElementById("round_winner").innerHTML = "";
                    user.timerObj.keepUpdating = setInterval(playGame_keepUpdatingFromServer, 200); //this starts game. goes every .2sec
                }
        });
    }
};
// on window load - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

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

function scoreboard_roundLog(roundLog) {
    let w = document.getElementById("roundLog_winner");
    let s = document.getElementById("roundLog_score");
    w.innerHTML = roundLog[0];
    s.innerHTML = roundLog[1] + " + " + roundLog[2];
}

//displays each players handSize, stillIn, yourTurn, score
function scoreboard(server_dict_varData) {
    let pt_div = document.getElementById("playType");
    if (!user.isBattle && !user.isDerby && pt_div.style.backgroundColor !== "limegreen") { //normal
        pt_div.style.backgroundColor = "limegreen";
        pt_div.style.fontFamily = "geneva";
        pt_div.style.lineHeight = "42px";
        pt_div.innerHTML = "Normal";
    } else if (user.isBattle && pt_div.innerHTML !== "Battle!!") {
        pt_div.style.backgroundColor = "deepskyblue";
        pt_div.style.fontFamily = "geneva";
        pt_div.style.lineHeight = "42px";
        pt_div.innerHTML = "Battle!!";
    } else if (user.isDerby && !user.isBattle && pt_div.innerHTML !== "Derby!") {
        pt_div.style.backgroundColor = "blueviolet";
        pt_div.style.fontFamily = "geneva";
        pt_div.style.lineHeight = "42px";
        pt_div.innerHTML = "Derby!";
    }
    for (let key in user.dict_varData) { //still in update
        if (server_dict_varData[key][1] !== user.dict_varData[key][1]) {
            let div_ = document.getElementById("sb_" + key);
            if (server_dict_varData[key][1]) {
                div_.style.backgroundColor = "green";
            } else {
                div_.style.backgroundColor = "red";
            }
        }
        //whos turn update
        if (server_dict_varData[key][2] !== user.dict_varData[key][2] || server_dict_varData[key][4] !== user.dict_varData[key][4]) {
            let div_ = document.getElementById("sb_" + key);
            if (server_dict_varData[key][4]) {
                div_.style.borderStyle = "solid";
                div_.style.borderWidth = "5px";
                div_.style.borderColor = "orange";

            } else if (server_dict_varData[key][2]) {
                div_.style.borderStyle = "solid";
                div_.style.borderWidth = "5px";
                div_.style.borderColor = "gold";
            } else {
                div_.style.borderStyle = "solid";
                div_.style.borderWidth = "2px";
                div_.style.borderColor = "black";
            }
        }
        //cards in hand and score update
        if (server_dict_varData[key][0] !== user.dict_varData[key][0] || server_dict_varData[key][3] !== user.dict_varData[key][3] ) {
            let div_ = document.getElementById("sb_" + key);
            if (key === user.username) { //players name and score
                div_.innerHTML = "<span style=color:white>" + key + "</span> <br />" + "Cards: " + server_dict_varData[key][0] + "<br />" + "score: " + server_dict_varData[key][3];
            } else {
                div_.innerHTML = key + "<br />" + "Cards: " + server_dict_varData[key][0] + "<br />" + "score: " + server_dict_varData[key][3];
            }

        }
    }
}

//updates client with data from server/other players
function playGame_keepUpdatingFromServer() { //called every timestep (some amount of seconds) COMING FROM SERVER
    $.get(`/update_ServerToClient${roomID+"&"+user.username}`,
        function(data, status) {
            let server_data = JSON.parse(data.server_data);
            if (server_data.user_leaving !== "") {
                document.getElementById("round_winner").innerHTML = server_data.user_leaving + " just left the game... this game is over :(";
                document.getElementById("round_winner").style.backgroundColor = "red";
                document.getElementById("round_title").style.backgroundColor = "red";
            }
            if (user.higherIsBetter !== server_data.higherIsBetter) { //only update if incoming flag is diff from users flag
                user.higherIsBetter = server_data.higherIsBetter;
                if (server_data.higherIsBetter) {
                    document.getElementById("value").innerHTML = "Higher";
                    document.getElementById("hisb").style.backgroundColor = "#EAA754";
                } else {
                    document.getElementById("value").innerHTML = "Lower";
                    document.getElementById("hisb").style.backgroundColor = "pink";
                }
            }
            user.isBattle = server_data.isBattle;
            user.isDerby = server_data.isDerby;
            user.battleStack_Players = server_data.battleStack_Players;
            let len_servCP = server_data.cardPile.length;
            let len_userCP = user.cardPile.length;
            if (len_userCP < len_servCP) {
                for (let i = 0; i < len_servCP - len_userCP; i++) { //last moves in this loop will be most recent
                    let aMove = server_data.cardPile[len_servCP - len_userCP - i - 1]; //move not in user.cardPile yet
                    renderLastPlayed(aMove);
                    user.cardPile.unshift(aMove);
                }
                if (user.dict_varData[user.username][2] && !user.yourTurn_FirstCall) { //restart timer because someone else played while it was your turn
                    //user.timerObj.startTimeMS = Math.round( ((new Date()).getTime())/1000 );
                    user.yourTurn_FirstCall = true;
                    //localStorage.setItem('onTheClock', "F"); // Persists to browser storage
                }
            }
            user.cardPile = server_data.cardPile;
            if (server_data.end_round[0] === "true" && user.end_round === "false" && server_data.gameOver[0] !== "T") { //if incoming data is diff then update
                resetSelected();
                user.hand = server_data.hand; //only time server updates users hand, do this before setHand() which happens in endRound() below
                setHand(); //can only refuel after a round is over.
                scoreboard_roundLog(server_data.roundLog);
                endRound(server_data.end_round[1], server_data.roundLog);
            }
            scoreboard(server_data.dict_varData); // update displays of each players: handSize, stillIn, yourTurn, score
            user.dict_varData = server_data.dict_varData;
            user.yourTurn = server_data.dict_varData[user.username][2];
            if (user.cardsInDeck !== server_data.cardsInDeck) {
                user.cardsInDeck = server_data.cardsInDeck;
                document.getElementById("cardDeck").innerHTML = user.cardsInDeck; //display num cards left in deck
            }
            updateChatList(server_data.chatList);
            if (server_data.gameOver[0] === "T") { // gameOver
                scoreboard_roundLog(server_data.roundLog);
                clearInterval(user.timerObj.keepUpdating);
                var res = "";
                for (let i = 0; i < server_data.gameOver[1].length; i++) {
                    if (i < server_data.gameOver[1].length - 1) {
                        res = res + server_data.gameOver[1][i] + " and ";
                    } else {
                        res = res + server_data.gameOver[1][i];
                    }
                }
                document.getElementById("round_winner").innerHTML = res + " WON! To play again exit and create a new room.";
                document.getElementById("round_winner").style.backgroundColor = "gold";
                document.getElementById("round_title").style.backgroundColor = "gold";
            } else {
                playGame_afterServerUpdate();
            }
    });
}


//continuous functionality of client if it is his turn or not
function playGame_afterServerUpdate() { //called every second
    if(user.end_round === "false") { //instead of using a while loop, use an interval
        if (user.dict_varData[user.username][1]) { // still in?
            if (user.yourTurn === true) { // your turn ?
                if (user.yourTurn_FirstCall) { //the first and only time this will execute when its your turn
                    // - - - TIMER STUFF ***
                    if (user.dict_varData[user.username][4]) { //you have been sandwiched
                        user.timerObj.timeoutNum = 15000; //15 seconds to play
                    } else {
                        user.timerObj.timeoutNum = 45000; //45 seconds to play
                    }
                    /*
                    if (localStorage.getItem('onTheClock') === "T") { //exited window or something ... ? bc 'onTheClock' should be false at this point
                        user.timerObj.startTimeMS = localStorage.getItem('start_time');
                        console.log("ls otc");
                        //console.log("Going to locStorage to get start time");
                    } else { //normal flow path if you havent left window/browser page
                        localStorage.setItem('onTheClock', "T"); // Persists to browser storage
                        console.log("reg otc");
                        //console.log(localStorage.getItem('onTheClock'));
                        user.timerObj.startTimeMS = Math.round( ((new Date()).getTime())/1000 ); //start timer
                        localStorage.setItem('start_time', user.timerObj.startTimeMS);
                    }
                    */
                    user.timerObj.startTimeMS = Math.round( ((new Date()).getTime())/1000 ); //start timer
                    // - - - TIMER STUFF ***
                    resetSelected(); //before you begin your turn just clear the hand of any selected cards
                    //console.log("Before_play");
                    //console.log(user.cardSelectedStack);
                    //console.log(user.hand);
                    user.yourTurn_FirstCall = false;
                }

                let divClock = document.getElementById("clock");

                if(!user.hasPlayed) { //while user has not played, should start as false
                    if (user.hand.length === 0) {//ran out of cards...
                        document.getElementById("foldButton").style.display = "none";
                        document.getElementById("passButton").style.display = "none";
                        document.getElementById("playButton").style.display = "none";
                        document.getElementById("battleButton").style.display = "none";
                        if (user.isBattle) {
                            user.playedMove_toServ = [['outofcards'], 'outofcards', user.username, []]; //going to serv
                        } else if (user.isDerby) {
                            user.playedMove_toServ = [['pass'], 'pass', user.username, []];
                        } else {
                            user.playedMove_toServ = [['outofcards'], 'outofcards', user.username, []]; //going to serv
                        }
                        user.hasPlayed = true;
                    } else if (user.hand.length > 0) {
                        if (user.dict_varData[user.username][4]) { // sandwiched
                            document.getElementById("playButton").style.display = "none";
                            document.getElementById("battleButton").style.display = "block";
                            document.getElementById("foldButton").style.display = "none";
                            document.getElementById("passButton").style.display = "none";
                        } else if (user.isDerby && !user.isBattle) { //derby
                            document.getElementById("foldButton").style.display = "none";
                            document.getElementById("passButton").style.display = "block";
                            document.getElementById("battleButton").style.display = "none";
                            document.getElementById("playButton").style.display = "block";
                        } else if (user.isBattle) {
                            document.getElementById("foldButton").style.display = "none";
                            document.getElementById("passButton").style.display = "none";
                            document.getElementById("battleButton").style.display = "block";
                            document.getElementById("playButton").style.display = "block";
                        } else { //normal
                            document.getElementById("foldButton").style.display = "block";
                            document.getElementById("passButton").style.display = "none";
                            document.getElementById("battleButton").style.display = "none";
                            document.getElementById("playButton").style.display = "block";
                        }
                    }
                    // - - - TIMER STUFF ***
                    let curTime = Math.round( ((new Date()).getTime())/1000 ); //user.timerObj.timeoutVar - ( (new Date()).getTime() - user.timerObj.startTimeMS);
                    let passedTime = Math.round( curTime - user.timerObj.startTimeMS );
                    let timeLeft = Math.round( (user.timerObj.timeoutNum / 1000) - passedTime ); //in sec

                    if (timeLeft >= 20 && divClock.innerHTML !== ("" + timeLeft) ) {
                        divClock.style.backgroundColor = "green";
                        divClock.innerHTML = timeLeft;
                    } else if (timeLeft < 20 && timeLeft >= 10 && divClock.innerHTML !== ("" + timeLeft)) {
                        divClock.style.backgroundColor = "orange";
                        divClock.innerHTML = timeLeft;
                    } else if (timeLeft < 10 && timeLeft >= 0 && divClock.innerHTML !== ("" + timeLeft)) {
                        divClock.style.backgroundColor = "red";
                        divClock.innerHTML = timeLeft;
                    } else if (timeLeft < 0) {
                        divClock.style.backgroundColor = "white";
                        divClock.innerHTML = '45';
                        autoPlay();
                    }
                    // - - - TIMER STUFF ***
                } else { //has played
                    //document.getElementById("foldButton").style.display = "none";
                    //document.getElementById("passButton").style.display = "none";
                    //document.getElementById("playButton").style.display = "none";
                    //document.getElementById("battleButton").style.display = "none";
                    //document.getElementById("nineButton").style.display = "none";
                    //localStorage.setItem('onTheClock', "F"); //you are no longer on the clock
                    //if (divClock.style.backgroundColor !== "white" || divClock.innerHTML !== '45') { // reset clock
                    //    divClock.style.backgroundColor = "white";
                    //    divClock.innerHTML = '45';
                    //}
                    //user.hasPlayed = false; //reset hasPlayed bool
                    //user.yourTurn_FirstCall = true;
                    //user.yourTurn = false;
                    let post_obj = {};
                    post_obj.roomID = roomID;
                    post_obj.user = user.username;
                    post_obj.usersHand = user.hand;
                    post_obj.usersMove = user.playedMove_toServ;
                    post_obj.isBattle = user.isBattle_toServ;
                    post_obj.isSandwich = user.isSandwich_toServ;
                    post_obj.isDerby = user.isDerby_toServ;
                    let post_JSON = JSON.stringify(post_obj);
                    //once played, send data to server, only after your turn
                    try {
                        $.post('/turnOver_update_clientToServer',
                            {
                                user_data: post_JSON
                            },
                            function(data, status) {
                                console.log("Status Play");
                                console.log(status);
                                if (status === "success") {
                                    user.hasPlayed = false; //reset hasPlayed bool
                                    user.yourTurn_FirstCall = true;
                                    user.yourTurn = false;
                                    user.isDerby_toServ = false;
                                    user.isBattle_toServ = ["F", ""];
                                    user.isSandwich_toServ = ["F", "", "", ""];
                                    document.getElementById("foldButton").style.display = "none";
                                    document.getElementById("passButton").style.display = "none";
                                    document.getElementById("playButton").style.display = "none";
                                    document.getElementById("battleButton").style.display = "none";
                                    document.getElementById("nineButton").style.display = "none";
                                    if (divClock.style.backgroundColor !== "white" || divClock.innerHTML !== '45') { // reset clock
                                        divClock.style.backgroundColor = "white";
                                        divClock.innerHTML = '45';
                                    }
                                } else {
                                    alert("error, did not send... try again");
                                    resetSelected();
                                    user.hand = user.hand_fallback;
                                    user.hasPlayed = false; // still need to play
                                }
                        });
                    } catch {
                        alert("uh... an error ocurred. It did not send.");
                        resetSelected();
                        user.hand = user.hand_fallback;
                        user.hasPlayed = false; // still need to play
                    }
                }
            } else { //not your turn so wait or could have gotten sandwiched to get to this path
                //localStorage.setItem('onTheClock', "F"); //you are no longer on the clock
                user.yourTurn_FirstCall = true;
                let divClock = document.getElementById("clock");
                if (divClock.style.backgroundColor !== "white" || divClock.innerHTML !== '45') { // reset clock
                    divClock.style.backgroundColor = "white";
                    divClock.innerHTML = '45';
                }
                document.getElementById("foldButton").style.display = "none";
                document.getElementById("passButton").style.display = "none";
                document.getElementById("playButton").style.display = "none";
                document.getElementById("nineButton").style.display = "none";
                if (user.hand.length === 0) {
                    document.getElementById("battleButton").style.display = "none";
                } else {
                    document.getElementById("battleButton").style.display = "block";
                }
            }
        } else { //not in round
            user.yourTurn_FirstCall = true;
            let divClock = document.getElementById("clock");
            if (divClock.style.backgroundColor !== "white" || divClock.innerHTML !== '45') { // reset clock
                divClock.style.backgroundColor = "white";
                divClock.innerHTML = '45';
            }
            document.getElementById("foldButton").style.display = "none";
            document.getElementById("passButton").style.display = "none";
            document.getElementById("playButton").style.display = "none";
            document.getElementById("battleButton").style.display = "none";
        }
    } else if (user.gameOver[0] === "T") { //game is over
        //Game is over!
        //alert("GAME OVER! Winner: " + user.gameOver[1]);
    } else {
        //waiting 10 seconds for peeps to see who won/how because round is over
    }
}


//makes sure all cards selected are the same when action button like play or battle is pressed
function allSame() {
    let allSame = true;
    for (let i = 1; i < user.cardSelectedStack.length; i++) {
        let prevCard = user.cardSelectedStack[i-1].split("_")[3].substr(0, user.cardSelectedStack[i-1].split("_")[3].length - 1); //card value
        let curCard = user.cardSelectedStack[i].split("_")[3].substr(0, user.cardSelectedStack[i].split("_")[3].length - 1); //card value
        if (prevCard === '14') {
            prevCard = user.cardSelectedStack[i-1].split("_")[4].substr(0, user.cardSelectedStack[i-1].split("_")[4].length - 1);
        }
        if (curCard === '14') {
            curCard = user.cardSelectedStack[i].split("_")[4].substr(0, user.cardSelectedStack[i].split("_")[4].length - 1);
        }
        if (prevCard !== curCard) {
            allSame = false;
            break;
        }
    }
    return allSame
}



//only seen when you are in but its not your turn but could be if you came in to battle or sandwhich someone
function battleSandwich() { //if was not clients turn but decided to battle/sandwhich
    let inBattle = false;
    for (let i = 0; i < user.battleStack_Players.length; i++) { //see if player is already participating in battle
        if (user.username === user.battleStack_Players[i]) {
            inBattle = true;
            break;
        }
    }
    let playable = true;
    let lastPlay = '';
    let lastFoe = '';
    let whoPlayedLast = '';
    if ( user.cardSelectedStack.length === 1 || (user.cardSelectedStack.length > 1 && allSame()) ) { //if all cards selected are same or a single card is chosen: valid so far
        for (let i = 0; i < user.cardPile.length; i++) {
            if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                lastPlay = user.cardPile[i][0];
                //console.log('lastPlay_B');
                //console.log(lastPlay);
                lastFoe = user.cardPile[i][2];
                break; //the reason we loop instead of picking top of queue is because we only play against 'play' cards, not wild or fold cards.
            }
        }
        if (user.cardPile.length > 0) {
            whoPlayedLast = user.cardPile[0][2]; //could be a wild card 9 => 'wild'
        }
        if (lastPlay === '') { //user is first to play this round so as long as user doesn't play more than 1 card he can play anything
            playable = false;
            alert("Can't battle! No one has played yet!");
        } else if (whoPlayedLast === user.username || lastFoe === user.username) { //lastFoe
            playable = false;
            alert("Either you played last or you are trying to battle yourself!");
        } else { //someone played before user, must beat that card(s)
            let usersCard = user.cardSelectedStack[0].split("_")[3].substr(0, user.cardSelectedStack[0].split("_")[3].length - 1); //card value
            let lastPlayedCard = lastPlay[0].substr(0, lastPlay[0].length - 1); //card value
            usersCard = parseInt(usersCard); //was string
            lastPlayedCard = parseInt(lastPlayedCard);  //was string
            if (usersCard === 14) { //joker so change grab last num in div string and that is the card val chosen (options menu val)
                usersCard = user.cardSelectedStack[0].split("_")[4].substr(0, user.cardSelectedStack[0].split("_")[4].length - 1); //card value
                usersCard = parseInt(usersCard); //was string
            }

            if (usersCard === lastPlayedCard) {
                //console.log(user.dict_varData[user.username][4]);
                if (user.dict_varData[user.username][4] === true) { //if you are sandwiched
                    //console.log("ReSand BABY!");
                    if (user.cardSelectedStack.length > 1) {
                        //console.log("ReSand derby");
                        user.isDerby_toServ = true;
                    }
                    user.isSandwich_toServ = ["T", lastFoe, usersCard, "RS"];
                } else if (user.cardSelectedStack.length > lastPlay.length) {
                    user.isSandwich_toServ = ["T", lastFoe, usersCard, ""];
                    user.isDerby_toServ = true;
                } else if (inBattle) { //already in the battle, and then you play the same card again so its a sandwich
                    user.isSandwich_toServ = ["T", lastFoe, usersCard, ""];
                    //user.isDerby_toServ = true;
                } else if (user.cardSelectedStack.length === lastPlay.length) {
                    user.isBattle_toServ = ["T", lastFoe]; //set flag to indicate battle order of play
                } else if (user.cardSelectedStack.length < lastPlay.length) {
                    playable = false; // not valid
                    alert("Its a Derby. You need to play more cards!");
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
        user.playedMove_toServ = [user.cardSelectedStack_toServ.slice(), 'play', user.username, []]; //going to serv
        removeResetSelectedFromHand(); //remove cards from cardSelectedStack after action
        let post_obj = {};
        post_obj.roomID = roomID;
        post_obj.user = user.username;
        post_obj.usersHand = user.hand;
        post_obj.usersMove = user.playedMove_toServ;
        post_obj.isBattle = user.isBattle_toServ;
        post_obj.isSandwich = user.isSandwich_toServ;
        post_obj.isDerby = user.isDerby_toServ;
        let post_JSON = JSON.stringify(post_obj);
        try {
            $.post('/turnOver_update_clientToServer', //once played, send data to server, only after your turn
                {
                    user_data: post_JSON
                },
                function(data, status) {
                    console.log("Status Battle Play");
                    console.log(status);
                    if (status === "success") {
                        user.isDerby_toServ = false;
                        user.isBattle_toServ = ["F", ""];
                        user.isSandwich_toServ = ["F", "", "", ""];
                    } else {
                        alert("error, did not send... try again");
                        resetSelected();
                        usersMove.hand = user.hand_fallback;
                    }

            });
        } catch {
            alert("uh... an error ocurred. It did not send.");
            resetSelected();
            user.hand = user.hand_fallback;
        }
    }
}


//user has pressed the play button, display selected hand cards in pile
function play() {
    if (user.dict_varData[user.username][2]) { //your turn?  Validation below
        let playable = true;
        let lastPlay = '';
        let lastFoe = '';
        let whoPlayedLast = '';
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
                    if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat (dont need to beat a fold, pass or wild)
                        lastPlay = user.cardPile[i][0];
                        lastFoe = user.cardPile[i][2]; //last person to 'play' a normal card (not a fold, pass, or wild)
                        break; //only look for 'play' cards, not wild, pass, fold, etc.
                    }
                }
                if (user.cardPile.length > 0) {
                    whoPlayedLast = user.cardPile[0][2]; //last person to play, could be a wild card 9 => 'wild'
                }
                if (lastPlay === '' && user.cardSelectedStack.length === 1) {
                    //valid
                } else if (user.cardPile.length === 0 && user.cardSelectedStack.length > 1) {
                    playable = false;
                    alert("Can't start a round by playing multiple cards (Derby).");
                } else if (lastPlay === '' && user.cardPile.length > 0) { //user is first to play this round so as long as user doesn't play more than 1 card he can play anything
                    //valid, can play anything after ONLY anycombination of folded cards and wild cards
                    if (user.cardSelectedStack.length > 1) {
                        user.isDerby_toServ = true;
                    }
                } else if (lastPlay !== '') { //someone played before user, must beat that card(s)
                    let usersCard = user.cardSelectedStack[0].split("_")[3].substr(0, user.cardSelectedStack[0].split("_")[3].length - 1); //card value
                    let lastPlayedCard = lastPlay[0].substr(0, lastPlay[0].length - 1); //card value
                    usersCard = parseInt(usersCard); //was string
                    lastPlayedCard = parseInt(lastPlayedCard);  //was string
                    if (usersCard === 14) { //joker so change grab last num in div string and that is the card val chosen (options menu val)
                        usersCard = user.cardSelectedStack[0].split("_")[4].substr(0, user.cardSelectedStack[0].split("_")[4].length - 1); //card value
                        usersCard = parseInt(usersCard); //was string
                    }

                    if ( (user.cardSelectedStack.length >= lastPlay.length && usersCard === 15) ||
                         (usersCard === 69 && user.cardSelectedStack.length === 1 && lastPlay.length === 1) ) {
                        //valid, ace/aces were played or rotten egg was played
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
                        } else if (usersCard === lastPlayedCard && (whoPlayedLast === user.username || lastFoe === user.username) ) {
                            playable = false;
                            alert("Can't battle yourself!");
                        } else if (usersCard === lastPlayedCard && whoPlayedLast !== user.username && lastFoe !== user.username) {
                            user.isBattle_toServ = ["T", lastFoe]; //set flag to indicate battle order of play
                            //alert("BATTLE!"); // valid, BATTLE
                        }
                    } else if (user.cardSelectedStack.length < lastPlay.length) {
                        playable = false; // not valid
                        alert("Its a Derby. You need to play more cards!");
                    } else if (user.cardSelectedStack.length > lastPlay.length && lastPlay.length > 1 ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && user.higherIsBetter && usersCard >= lastPlayedCard ||
                               user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && !user.higherIsBetter && usersCard <= lastPlayedCard )
                        {
                        if (usersCard === lastPlayedCard && (whoPlayedLast === user.username || lastFoe === user.username) ) {
                            playable = false;
                            alert("Can't sandwich yourself!");
                        } else {
                            user.isDerby_toServ = true;
                            if (usersCard === lastPlayedCard) { //valid
                                user.isSandwich_toServ = ["T", lastFoe, usersCard, ""];
                            }
                        }
                    } else { // should never get here...
                        playable = false; // not valid
                        if (user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && user.higherIsBetter && usersCard < lastPlayedCard) {
                            alert("Not valid! When starting a Derby, your card must be higher than the last card if higher is better");
                        } else if (user.cardSelectedStack.length > lastPlay.length && lastPlay.length === 1 && !user.higherIsBetter && usersCard > lastPlayedCard) {
                            alert("Not valid! When starting a Derby, your card must be lower than the last card if lower is better");
                        } else {
                            //uh ... ??
                        }
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
            user.playedMove_toServ = [user.cardSelectedStack_toServ.slice(), 'play', user.username, []]; //going to serv
            removeResetSelectedFromHand(); //remove cards from cardSelectedStack after action
            user.hasPlayed = true;
        }
    } else {
        //cant play bc not your turn...
    }
}


function pass() { //should only appear during a derby
    if (user.isDerby) {
        user.playedMove_toServ = [['pass'], 'pass', user.username, []];
        resetSelected();
        user.hasPlayed = true;
    }
}


//displays folded cards on pile, hill only happen/appear if user is still in and its not a Derby
function fold() { //should not appear during a derby
    if (!user.isDerby) {
        if (user.cardSelectedStack_toServ.length > 0) {
            user.playedMove_toServ = [user.cardSelectedStack_toServ.slice(), 'fold', user.username, []];
            removeResetSelectedFromHand();
            user.hasPlayed = true;
        } else {
            alert("You need to select a card to fold.");
        }
    }
}


//if 9 is chossen to be played as a wild card 9
function nine() { // should only appear if 1 nine is selected not during a derby
    let isHigher = user.higherIsBetter
    if (user.dict_varData[user.username][4]) {
        alert("Not playable. Must play the same card opponent played.");
    } else if (user.dict_varData[user.username][2]) {
        let lastPlay = '';
        for (let i = 0; i < user.cardPile.length; i++) {
            if (user.cardPile[i][1] === 'play') { //the card(s) that the user must beat
                lastPlay = user.cardPile[i][0];
                break;
            }
        }
        if ( (user.isDerby && user.isBattle) || (!user.isDerby) ) { //not a derby
            if (isHigher) {
                //document.getElementById("value").innerHTML = "Lower";
                isHigher = "wild_L";
            } else {
                //document.getElementById("value").innerHTML = "Higher";
                isHigher = "wild_H";
            }
            user.playedMove_toServ = [[isHigher], 'wild', user.username, []];
            removeResetSelectedFromHand();
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
    if (user.dict_varData[user.username][4]) { // sandwiched
        user.playedMove_toServ = [['SW'], 'SW', user.username, []];
    } else if (user.isDerby && !user.isBattle) { //is Derby so pass
        user.playedMove_toServ = [['pass'], 'pass', user.username, []];
    } else { //fold because its normal play
        let randomCardNum = Math.floor((Math.random() * user.hand.length));
        if (user.isBattle) {
            user.playedMove_toServ = [[user.hand[randomCardNum]], 'play', user.username, []];
        } else { //normal
            user.playedMove_toServ = [[user.hand[randomCardNum]], 'fold', user.username, []];
        }
        resetSelected(); //remove cards from cardSelectedStack and sets them in hand to white
        removeCardFromHand_AUTO(randomCardNum); //removes div/img from hand display given hand index and removes card from hand array []
    }
    user.hasPlayed = true;
}


//display card images of hand, add event listener for selecting cards
function setHand() {
    document.getElementById("hand_R").remove(); //reset hand each time
    let tr_ = document.createElement('tr');
    tr_.id = "hand_R";
    document.getElementById("hand_T").appendChild(tr_);
    for(let j = 0; j < user.hand.length; j++) { //loop thru players hand list
        let td_ = document.createElement("td");
        let div_ = document.createElement("div");
        div_.style.backgroundColor = "white";
        //div_.style.width = "75px"; //90
        //div_.style.height = "105px"; //150
        div_.style.color = "white";
        div_.style.textAlign = "center";
        div_.style.verticalAlign = "middle";
        div_.style.lineHeight = "10px";
        //div_.className = "handDivs";
        div_.style.padding = "3px 2px 8px 2px";
        div_.style.borderRadius = "15px";
        let card_IMG = document.createElement("IMG");
        card_IMG.setAttribute("src", `/images/${user.hand[j]}.png`);
        card_IMG.className = "imgInHand";
        if (user.hand[j] == "14j") {
            div_.style.width = "95px";
            div_.style.height = "120px";
        }
        card_IMG.setAttribute("width", "65"); //80
        card_IMG.setAttribute("height", "92"); //120
        //card_IMG.style.padding = "0px 0px 0px 0px";
        card_IMG.style.margin = "5px 5px 5px 5px";
        card_IMG.id = `hand_${j}_${user.hand[j]}`;
        div_.id = `div_hand_${j}_${user.hand[j]}`;
        td_.id = `td_div_hand_${j}_${user.hand[j]}`;
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
            {val : "69x", text: 'Rotten Egg'}, //has dummy 'x' in val because code parses all cards by truncating last char
        ];

        let sel = $('<select class=\'optionsMenu\'>').appendTo(div_);
        $(arr).each(function() {
            sel.append($("<option>").attr('value',this.val).text(this.text));
        });

        sel.on("change", function(event) {
            let option_val = $(this).children("option:selected").val();
            let img_id = $(this).parent().children(0).get(0).id;
            let l = 0;
            //console.log("CHANGE :old: " + img_id);
            if (img_id.split("_").length === 4) { //joker
                l = img_id.split("_")[3].length;
            } //else if (img_id.split("_").length === 3) { //non joker
                //l = img_id.split("_")[2].length;
                //let option_text = $(this).children("option:selected").text();
                //the whole point here is that we are re-assigning the div and img
                //ids to new ids so they represent a specific val/card instead of wild
                //let option_val = $(this).children("option:selected").val();
                //let img_id = $(this).parent().children(0).get(0).id;
                //let l = img_id.split("_")[2].length;
                //let new_id = img_id.substr(0, img_id.length - l) + "_" + option_val;
                //document.getElementById(img_id).id = new_id; //set divs id to the new id
                //document.getElementById( "div_" + img_id ).id = "div_" + new_id; //set divs id to the new id
                //document.getElementById( "td_div_" + img_id ).id = "td_div_" + new_id; //set the td id to the new id
                //console.log("CHANGE :new: " + new_id);
                //console.log(" - - - ");
                //cardsSelected(new_id, img_id);
            //}
            let new_id = img_id.substr(0, img_id.length - l - 1) + "_" + option_val;
            document.getElementById(img_id).id = new_id; //set divs id to the new id
            document.getElementById( "div_" + img_id ).id = "div_" + new_id; //set divs id to the new id
            document.getElementById( "td_div_" + img_id ).id = "td_div_" + new_id; //set the td id to the new id
            //console.log("CHANGE :new: " + new_id);
            //console.log("- - -");
            cardsSelected(new_id, img_id);
        });
        //set div and img ids to have val "2s" as is in menu initially
        let img_ID = div_.id.substr(4); //gets img id, does not have "div_" in it
        document.getElementById(img_ID).id = img_ID + "_2s"; //set img id to the new id
        document.getElementById(div_.id).id = div_.id + "_2s"; //set divs id to the new id
        document.getElementById("td_div_" + img_ID).id = "td_div_" + img_ID + "_2s"; //set td id to the new id
}


//highlights and unhighlights cards as they are clicked on
//param is the img id of the img card clicked on
//shows nine wild button if selection is just a nine
//params: clicked-on/new id, old wild id   :  the second param is only a string if
//the card is a wild card and the client changes the menu option while the card
//is selected, so have to change the id instead of a push or pop
// ex div joker id: div_hand_12_14j_2s
function cardsSelected(img_ID, old_ID){
    //console.log("bf CCS");
    //console.log(user.cardSelectedStack);
    document.getElementById("nineButton").style.display = "none";
    let div_ID = 'div_' + img_ID;
    let img = img_ID.split("_")[2]; //grabs just the img
    let d = document.getElementById(div_ID);
    let pos = user.cardSelectedStack.indexOf(div_ID);
    if (old_ID === "") { //a direct string change is not needed, push or pop is needed
        if ( pos >= 0 ) { //if the id is in the array, its already selected, so UNhighlight it
            if (img.indexOf('9', 0) >= 0 && user.cardSelectedStack.length === 1 ) { //selected card was a 9 not from joker
                document.getElementById("nineButton").style.display = "none";
            }
            d.style.backgroundColor = "white";
            user.cardSelectedStack.splice(pos, 1);
            user.cardSelectedStack_toServ.splice(pos, 1); //has same functionality as cardSelectedStack
        } else { //if its not in the array then Highlight the card and add it to the array
            if (img.indexOf('9', 0) >= 0 && user.cardSelectedStack.length === 0) { //only selected card is a 9 not from joker
                if (user.dict_varData[user.username][2] && ((user.isDerby && user.isBattle) || (!user.isDerby)) ) {
                    document.getElementById("nineButton").style.display = "block";
                }
            }
            if (img === "14j") {
                img = div_ID.split("_")[4];
                user.cardSelectedStack_toServ.push(img); //img from joker div_ID.split("_")[4]
            } else {
                user.cardSelectedStack_toServ.push(img); //non joker img
            }
            d.style.backgroundColor = "blue";
            user.cardSelectedStack.push(div_ID);
        }
        if (user.cardSelectedStack.length > 1) {
            document.getElementById("nineButton").style.display = "none";
        } else if (user.cardSelectedStack.length === 1 && user.cardSelectedStack[0].split("_")[3].indexOf('9', 0) >= 0) {
            if (user.dict_varData[user.username][2] && ((user.isDerby && user.isBattle) || (!user.isDerby)) ) {
                document.getElementById("nineButton").style.display = "block";
            }
        }
    } else { //here bc card is joker options change. Find and change the old joker id to new id
        pos = user.cardSelectedStack.indexOf("div_" + old_ID); //pos of old joker id
        if (pos >= 0) {
            user.cardSelectedStack[pos] = div_ID; //replace with new id
            let new_img = div_ID.split("_")[4];
            user.cardSelectedStack_toServ[pos] = new_img; //new joker value
        }
    }
    //console.log("af CCS");
    //console.log(user.cardSelectedStack);
}


//resets any selected cards in hand back to white and clears the cardSelectedStack and the cardSelectedStack_toServ
function resetSelected() {
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        document.getElementById( user.cardSelectedStack[i] ).style.backgroundColor = "white";
    }
    user.cardSelectedStack = []; //reset
    user.cardSelectedStack_toServ = []; //reset
}


//called by auto play, gives a param index so can delete that card from hand array and the div/img from hand display
function removeCardFromHand_AUTO(ind) {
    let id = document.getElementById("hand_R").children[ind].id; //td id
    document.getElementById("hand_R").children[ind].remove();
    user.hand.splice(ind, 1); //removes card from hand array
}


//sets the background color of all selected cards back to white
//clears the user.cardSelectedStack back to empty []
//removes played cards from the users hand array
function removeResetSelectedFromHand() {
    user.hand_fallback = user.hand; //take snapshot of hand's state before mutating hand so that in event of server post error, can reset hand
    for (let i = 0; i < user.cardSelectedStack.length; i++) {
        document.getElementById("td_" + user.cardSelectedStack[i]).remove(); //removes td element so removes the td, div and card img from hand
        user.hand.splice(user.hand.indexOf(user.cardSelectedStack[i].split("_")[3]), 1); //remove card from users hand, [3] grabs the div string
    }
    user.cardSelectedStack = []; //reset
    user.cardSelectedStack_toServ = []; //reset
}

//clears card pile
function resetCardPile() {
    document.getElementById('cardPileRow').remove(); //remove cardPile
    let tr_ = document.createElement('tr');
    tr_.id = "cardPileRow";
    document.getElementById('cardPile_T').appendChild(tr_);
}


function randomColor() { //for background of card img divs
    let r1 = Math.floor((Math.random() * 255));
    let r2 = Math.floor((Math.random() * 255));
    let r3 = Math.floor((Math.random() * 255));
    return "rgb(" + r1 + ", " + r2 + ", " + r3 + ")";
}

function renderLastPlayed(last) {
    let alreadyInserted = false;
    let pileRow = document.getElementById("cardPileRow");
    if (last[3].length > 0) {
        if (last[3][0] === 'S') { //card just played sandwiched other cards, this block will NOT insert the last played card
            for (let p = 0; p < last[3][1].length; p++) { //go through sandwiched people
                if (last[3][1][p] !== last[2] ) {
                    for (let s = 0; s < user.cardPile.length; s++) {
                        if (last[3][1][p] === user.cardPile[s][2] && user.cardPile[s][1] === 'play') { //index into the card pile dom wont match a 'lost card'
                            let td = pileRow.children[s];
                            let div = td.firstChild; // works too: let div = pileRow.children[s].children[0];
                            let SAND_div = document.createElement("div");
                            SAND_div.style.backgroundColor = "limegreen";
                            SAND_div.className = "cardPileDivs";
                            td.insertBefore(SAND_div, div);
                            SAND_div.appendChild(div);
                            let para = document.createElement('P');
                            let txt = document.createTextNode("Sandwiched!");
                            para.className = "pInDiv";
                            para.appendChild(txt);
                            SAND_div.appendChild(para);
                            break;
                        }
                    }
                }
            }
        } else if (last[3][0] === 'RS') {
            for (let p = 0; p < last[3][1].length; p++) { //go through sandwiched people
                if (last[3][1][p] !== last[2] ) {
                    for (let s = 0; s < user.cardPile.length; s++) {
                        if (last[3][1][p] === user.cardPile[s][2] && user.cardPile[s][1] === 'play') { //index into the card pile dom wont match a 'lost card'
                            let td = pileRow.children[s];
                            let div = td.firstChild; // works too: let div = pileRow.children[s].children[0];
                            let SAND_div = document.createElement("div");
                            SAND_div.style.backgroundColor = "limegreen";
                            SAND_div.className = "cardPileDivs";
                            td.insertBefore(SAND_div, div);
                            SAND_div.appendChild(div);
                            let para = document.createElement('P');
                            let txt = document.createTextNode("Sandwiched!");
                            para.className = "pInDiv";
                            para.appendChild(txt);
                            SAND_div.appendChild(para);
                        } else if (last[2] === user.cardPile[s][2] && user.cardPile[s][1] === 'play') {
                            break; //go until u run into users first resand card
                        }
                    }
                }
            }
            for (let r = 0; r < user.cardPile.length; r++) {
                if (last[2] === user.cardPile[r][2] && user.cardPile[r][1] === 'play') { // unsandwhich users last play
                    let td = pileRow.children[r];
                    let div = td.firstChild; // works too: let div = pileRow.children[s].children[0];
                    let unSAND_div = document.createElement("div");
                    unSAND_div.style.backgroundColor = "purple";
                    unSAND_div.className = "cardPileDivs";
                    td.insertBefore(unSAND_div, div);
                    unSAND_div.appendChild(div);
                    let para = document.createElement('P');
                    let txt = document.createTextNode("Unsandwiched!");
                    para.className = "pInDiv";
                    para.appendChild(txt);
                    unSAND_div.appendChild(para);
                    break;
                }
            }
        } else if (last[3][0] === 'B') { //battle was just initiated
            alreadyInserted = true; // this block will insert the last played card
            if (last[3][1].length === 1) {
                for (let s = 0; s < user.cardPile.length; s++) {
                    if (last[3][1][0] === user.cardPile[s][2] && user.cardPile[s][1] === 'play') { //index into the card pile dom
                        let td = pileRow.children[s];
                        let div = td.firstChild; // works too: let div = pileRow.children[s].children[0];
                        let SAND_div = document.createElement("div");
                        SAND_div.style.backgroundColor = "deepskyblue";
                        SAND_div.className = "cardPileDivs";
                        td.insertBefore(SAND_div, div);
                        SAND_div.appendChild(div);
                        let para = document.createElement('P');
                        let txt = document.createTextNode("Battling!");
                        para.className = "pInDiv";
                        para.appendChild(txt);
                        SAND_div.appendChild(para);
                        break;
                    }
                }
            } // else if (last[3][1].length > 2) //person joined an already existing battle so
             // only need to insert, no need to update other cards visually
            // inserting the last played card
            let Batt_td = document.createElement("td");
            let Batt_div = document.createElement("div");
            Batt_div.style.backgroundColor = "deepskyblue";
            Batt_div.className = "cardPileDivs";
            pileRow.insertBefore(Batt_td, pileRow.firstChild);
            Batt_td.appendChild(Batt_div);
            let div_ = document.createElement("div");
            div_.style.backgroundColor = randomColor();
            div_.className = "cardPileDivs";
            let p0 = document.createElement('P');
            let t0 = document.createTextNode(last[2]);
            p0.className = "p0InDiv";
            p0.appendChild(t0);
            div_.appendChild(p0);
            for(let j = 0; j < last[0].length; j++) { //if multiple cards were played by a single player
                let card_IMG = document.createElement("IMG");
                card_IMG.setAttribute("src", `/images/${ last[0][j]}.png`);
                card_IMG.className = "cardPileImages";
                div_.appendChild(card_IMG);
            }
            let p1 = document.createElement('P');
            let txt1 = document.createTextNode(last[2]); //who played the card
            p1.className = "pInDiv";
            p1.appendChild(txt1);
            div_.appendChild(p1);
            Batt_div.appendChild(div_);
            let bpara = document.createElement('P');
            let btxt = document.createTextNode("Battling!");
            bpara.className = "pInDiv";
            bpara.appendChild(btxt);
            Batt_div.appendChild(bpara);
        }
    }

    if (!alreadyInserted) { //insert the last played card if card is not initiating or getting in on a battle
        if (last[1] === 'battle') { //battle result, card was played after battle was initiated
            let B_td_ = document.createElement("td");
            let B_div_ = document.createElement("div");
            B_div_.style.backgroundColor = "deepskyblue";
            B_div_.className = "cardPileDivs";
            pileRow.insertBefore(B_td_, pileRow.firstChild);
            B_td_.appendChild(B_div_);
            let B_tabl = document.createElement("TABLE");
            let B_row = document.createElement("TR");
            B_div_.appendChild(B_tabl);
            B_tabl.appendChild(B_row);
            for(let i = 0; i < last[0].length; i++) { // loops thru battle stack in last played move[0]
                let td_ = document.createElement("td");
                let div_ = document.createElement("div");
                div_.style.backgroundColor = randomColor();
                div_.className = "cardPileDivs";
                B_row.appendChild(td_);
                td_.appendChild(div_);
                //players name above card img in white
                let p0 = document.createElement('P');
                let t0 = document.createTextNode(last[0][i][2]);
                p0.className = "p0InDiv";
                p0.appendChild(t0);
                div_.appendChild(p0);
                for(let j = 0; j < last[0][i][0].length; j++) { //if multiple cards were played by a single player
                    let card_IMG = document.createElement("IMG");
                    card_IMG.setAttribute("src", `/images/${ last[0][i][0][j] }.png`);
                    card_IMG.className = "cardPileImages";
                    div_.appendChild(card_IMG);
                }
                let p = document.createElement('P');
                let txt = document.createTextNode(last[0][i][2]); //who played the card
                p.className = "pInDiv";
                p.appendChild(txt);
                div_.appendChild(p);
            }
            let B_p = document.createElement('P');
            let B_txt = document.createTextNode(last[2]);
            B_p.className = "pInDiv";
            B_p.appendChild(B_txt);
            B_div_.appendChild(B_p);
        } else { //create 1 dive that will be the background for however many cards were played each time
            let td_ = document.createElement("td");
            let div_ = document.createElement("div");
            div_.style.backgroundColor = randomColor();
            div_.className = "cardPileDivs";
            td_.appendChild(div_);
            pileRow.insertBefore(td_, pileRow.firstChild);
            let p0 = document.createElement('P');
            let t0 = document.createTextNode(last[2]);
            p0.className = "p0InDiv";
            p0.appendChild(t0);
            div_.appendChild(p0);
            for(let j = 0; j < last[0].length; j++) {
                let card_IMG = document.createElement("IMG");
                if (last[1] === 'play') { //this uses the loop (play many), other cases have only 1 card
                    card_IMG.setAttribute("src", `/images/${last[0][j]}.png`);
                } else if (last[1] === 'fold') { //this uses the loop (fold many), other cases have only 1 card
                    card_IMG.setAttribute("src", '/images/fold.png');
                } else if (last[1] === 'wild') {
                    card_IMG.setAttribute("src", `/images/${last[0][0]}.png`);
                } else if (last[1] === 'pass') {
                    card_IMG.setAttribute("src", '/images/pass.png');
                } else if (last[1] === 'outofcards') {
                    card_IMG.setAttribute("src", '/images/outofcards.png');
                }
                card_IMG.className = "cardPileImages";
                div_.appendChild(card_IMG);
            }
            let p1 = document.createElement('P');
            let t1 = document.createTextNode(last[2]);
            p1.className = "pInDiv";
            p1.appendChild(t1);
            div_.appendChild(p1);
        }
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

function endRound(winner, roundLog) {
    user.end_round = "true";
    user.timerObj.endRound_timeout = setTimeout(newRound, 10000); //10 seconds
    document.getElementById("round_winner").innerHTML = winner + " won the round. Score: " + roundLog[1] + " + " + roundLog[2];
    document.getElementById("round_winner").style.backgroundColor = "pink";
    document.getElementById("round_title").style.backgroundColor = "pink";
    document.getElementById("foldButton").style.display = "none";
    document.getElementById("passButton").style.display = "none";
    document.getElementById("playButton").style.display = "none";
    document.getElementById("battleButton").style.display = "none";
    document.getElementById("nineButton").style.display = "none";
}

function newRound() {
    document.getElementById("round_winner").innerHTML = "";
    document.getElementById("round_title").style.backgroundColor = "#7F7C6A";
    document.getElementById("round_winner").style.backgroundColor = "#7F7C6A";
    user.isDerby_toServ = false;
    user.isBattle_toServ = false;
    user.isBattle = false;
    user.isDerby = false;
    resetCardPile(); //resets card pile because round ended and incoming card pile is empty so user pile should be too
    let newRound_obj = {};
    newRound_obj.roomID = roomID;
    let newRound_JSON = JSON.stringify(newRound_obj);
    $.post('/start_new_round',
        {
            user_data: newRound_JSON
        },
        function(data, status) {
            user.end_round = "false";
    });
}

//"Shutdown/deletion of room" : if lord leaves room, deletes room schema on mongodb
window.addEventListener('beforeunload', function(e) {
    if (user.username === user.lord) { //only the lord leaving can delete the room schema
        $.post('/deleteRoom',
            {
                roomID: roomID
            },
            function(data, status){
        });
    } else {
        //console.log("minion left...");
        $.post('/leftRoom',
            {
                roomID: roomID,
                user: user.username
            },
            function(data, status){
        });
    }
});
