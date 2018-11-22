

function tmp() {
    let a = ["a", "b"];
    let b = "15b";
    let dd = [];
    //dd[0].push("poop");
    let winner =  a[0] == "b";

    let c = "wild";
    //a.splice(a.indexOf("b"), 1)
    console.log(dd.length);


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
