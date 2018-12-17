

function tmp() {
    let a = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    let b = a.slice(0);

    console.log(a);
    console.log(b);

    a.splice(1,1);
    b.splice(0,1);

    console.log(a);
    console.log(b);
}


//let aa = [ "3c", "7s", "8s", "9c", "11s", "11d", "13c", "15d", "15s", "15h", "2c", "14j", "3h" ]
tmp()
