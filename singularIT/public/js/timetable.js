var modal = document.getElementById("talkModal");
var span = document.getElementsByClassName("close")[0];

var i, $mvar = $('.talk-column');
for(i = 0; i < $mvar.length; i++) {
    var id = $mvar.eq(i)[0].dataset["id"];
    // $mvar.eq(i)[0].onclick = function() {
    //     modal.style.display = "block";
    // }
}

span.onclick = function() {
    modal.style.display = "none";
}

window.onclick = function(event) {
    if(event.target == modal) {
        modal.style.display = "none";
    }
}
