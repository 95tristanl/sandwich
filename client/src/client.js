/**
 * Created by TristanLeVeille on 7/31/18.
 */
"use strict";

//var sessionstorage = require('sessionstorage');
var curUser = "No_Username";
var roomID = "No_Room_ID";

//when new game button is pressed creates a new gameRoom
function createNewGameRoom(event, form) {
    event.preventDefault();

    if (!form.username_c.value || !form.roomID_c.value) {
        alert('Please enter a username and password.');
        return;
    }

    if ( !form.deckSize.value || !form.gameSize.value || !form.handSize.value) {
        alert('fill in all boxes');
        return;
    }

    if ( ( (54 * parseInt(form.deckSize.value)) / parseInt(form.gameSize.value)) < parseInt(form.handSize.value) ) {
        alert('Yeah, try again, the math regarding decks, game size, and hand size does not add up here...');
        return;
    }

    curUser = form.username_c.value;

    $.post('/createdGame',
        {
            lord: form.username_c.value, //only the lord will be able to start the game once eveyone has joined
            roomID: form.roomID_c.value,
            deckSize: form.deckSize.value,
            gameSize: form.gameSize.value,
            handSize: form.handSize.value,
            refuelNum: form.refuelNum.value
        },
        function(data, status) {
            if (status === 'success') {
                roomID = form.roomID_c.value;
                localStorage.setItem('curUser', curUser); // Persists to browser storage
                location.assign("/gamePage.html?roomID=" + form.roomID_c.value);
            }
        }
    );
}


//when join game button is pressed brings user to the desired game if it exists
function joinGameRoom(event, form) {
    event.preventDefault();

    if (!form.username_j.value || !form.roomID_j.value) {
        alert('Please enter a username and password.');
        return;
    }

    curUser = form.username_j.value;

    jQuery.ajax({
        type: "POST",
        async: true,
        url: '/joinedGame',
        data:
        {
            username: form.username_j.value,
            roomID: form.roomID_j.value
        },
        success: function (data) {
            roomID = form.roomID_j.value;
            localStorage.setItem('curUser', curUser); // Persists to browser storage
            location.assign("/gamePage.html?roomID=" + form.roomID_j.value);
        },
        error: function (err) {
            console.log("POPCORN!!!");
            alert("either that is not a valid room or the username in that room is already taken.");
        }
    });
}



/*
// Create a new game. Emit newGame event.
$('#new').on('click', () => {
    const lord = $('#username_c').val();
    const roomID = $('#roomCode_create').val();
    const gameSize = $('#gameSize').val();
    const decks = $('#decksUsed').val();
    const handSize = $('#handSize').val();
    const refuleNum = $('#refuleNum').val();
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (!roomID) {
        alert('Please enter a room password.');
        return;
    }
    if ( ((54*decks)/gameSize) < handSize ) {
        alert('Yeah, try again, the math does not add up here...');
        return;
    }
    cGame = new Game(lord, roomID, gameSize, decks, handSize, refuleNum);
});
*/


// Join an existing game on the entered roomId. Emit the joinGame event.
/*
$('#join').on('click', () => {
    const name = $('#username_j').val();
    const roomID = $('#roomCode_join').val();
    if (!name || !roomID) {
        alert('Please enter your name and game ID.');
        return;
    }
    socket.emit('joinGame', { name, room: roomID });
    player = new Player(name, P2);
    //console.log("yo1");
    //console.log(io.nsps['/'].adapter.rooms[roomID].gameObj.lord);
    //console.log("yo2");
    //console.log(io.nsps['/'].adapter.rooms[roomID].gameObj);
    //console.log("yo3");
    //console.log(io.nsps['/'].adapter.rooms[roomID]);
    //console.log("yo4");
});
*/
