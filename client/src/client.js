/**
 * Created by TristanLeVeille on 7/31/18.
**/
"use strict";

//var sessionstorage = require('sessionstorage');
var curUser = "No_Username";
var roomID = "No_Room_ID";

//when new game button is pressed creates a new gameRoom
function createNewGameRoom(event, form) {
    event.preventDefault();

    if (form.username_c.value.match(/^[a-zA-Z0-9]{3,12}$/) ) {
        //valid
    } else {
        alert("Username must only contain letters and numbers and must be 3-12 characters!");
        return;
    }

    if (form.roomID_c.value.match(/^[a-zA-Z0-9]{5,20}$/) ) {
        //valid
    } else {
        alert("RoomID must only contain letters and numbers and must be 5-20 characters!");
        return;
    }

    if (form.gameSize.value.match(/^[1-9]{1,2}$/) && parseInt(form.gameSize.value) >= 2 && parseInt(form.gameSize.value) <= 30) {
        //valid
    } else {
        alert("Game size must only contain numbers and be between 2 and 30!");
        return;
    }

    if (form.deckSize.value.match(/^[1-9]{1,2}$/) && parseInt(form.deckSize.value) >= 1 && parseInt(form.deckSize.value) <= 20) {
        //valid
    } else {
        alert("Deck number must only contain numbers and be between 1 and 20!");
        return;
    }

    if (form.handSize.value.match(/^[1-9]{1,2}$/) && parseInt(form.handSize.value) >= 1 && parseInt(form.handSize.value) <= 20) {
        //valid
    } else {
        alert("Hand size must only contain numbers and be between 1 and 20!");
        return;
    }

    if (form.refuelNum.value.match(/^[0-9]{1,2}$/) && parseInt(form.refuelNum.value) >= 0 &&
        parseInt(form.refuelNum.value) < parseInt(form.handSize.value)) {
        //valid
    } else {
        alert("Refuel number must only contain numbers and be 0 or greater and less than the hand size!");
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
                //localStorage.setItem('onTheClock', "F"); //setting timer obj for when its your turn to false (you are not being timed to play yet)
                localStorage.setItem('curUser', curUser); // Persists to browser storage
                location.assign("/gamePage.html?roomID=" + form.roomID_c.value);
            }
        }
    );
}


//when join game button is pressed brings user to the desired game if it exists
function joinGameRoom(event, form) {
    event.preventDefault();

    if (form.username_j.value.match(/^[a-zA-Z0-9]{3,15}$/) ) {
        //valid
    } else {
        alert("Username must only contain letters and numbers and must be 3-15 characters!");
        return;
    }

    if (form.roomID_j.value.match(/^[a-zA-Z0-9]{5,20}$/) ) {
        //valid
    } else {
        alert("RoomID must only contain letters and numbers and must be 5-20 characters!");
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
            //localStorage.setItem('onTheClock', "F"); //setting timer obj for when its your turn to false (you are not being timed to play yet)
            localStorage.setItem('curUser', curUser); // Persists to browser storage
            location.assign("/gamePage.html?roomID=" + form.roomID_j.value);
        },
        error: function (err) {
            console.log("POPCORN!!!");
            alert("either that is not a valid room or the username in that room is already taken.");
        }
    });
}
