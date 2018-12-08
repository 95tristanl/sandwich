

function tmp() {
    let a = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    a.splice(10, 1);

    let timerObj = {};

    timerObj.name = "peop";
    console.log(timerObj.name);

}

function sortHand(hand) {
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
    return sortedHand;
}
//let aa = [ "3c", "7s", "8s", "9c", "11s", "11d", "13c", "15d", "15s", "15h", "2c", "14j", "3h" ]
tmp()
