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

$('#favorite-checkbox').change(function() {
    var id = $(this).attr("data-id");
    if($(this).prop("checked") == true) {
        // Register this as favorite.
        $.post("/api/favorite/add/" + id, {}, function(result) {
            if(!result.success) {
                // TODO: show user error.
                console.log("Could not add favorite!");
            }
        });
    } else {
        // Unregister this as favorite.
        $.post("/api/favorite/remove/" + id, {}, function(result) {
            if(!result.success) {
                // TODO: show user error.
                console.log("Could not remove favorite!");
            }
        });
    }
});

function animateHeight(previousHeight) {
    var element = document.getElementById('ModalContent');
    var sectionHeight = element.scrollHeight;
    var elementTransition = element.style.transition;

    requestAnimationFrame(function() {
        element.style.height = previousHeight + 'px';
        element.style.transition = elementTransition;

        requestAnimationFrame(function() {
            element.style.height = sectionHeight + 'px';
            element.addEventListener('transitionend', function(e) {
                element.removeEventListener('transitionend', arguments.callee);
                element.style.height = null;
            })
        })
    });
}

function talkColumnClick(talk) {
    document.getElementById('ModalTitle').innerHTML = talk.title;
    document.getElementById('favorite-checkbox').dataset.id = talk.id;
    document.getElementById('ModalContent').innerHTML = talk.subTitle;
    var timeText = talk.startTimeDisplay + " - " + talk.endTimeDisplay;
    document.getElementById('ModalFooter').innerHTML = timeText;
    document.getElementById('talkModal').style.display = 'block';
    $.get("/api/favorite/" + talk.id, function(data) {
        if(data.success) {
            $('#favorite-checkbox').prop('checked', data.favorite);
        } else {
            // TODO: show user error.
        }
    });
    if(talk.speaker) {
        $('#SpeakerButton').html(talk.speaker.name);
        $('#ModalImage').attr('src', talk.speaker.image);
        $('#EnrollButton').click(function() {
            console.log("asdf");
            $.post("/api/talks/enroll/" + talk.id, {}, function(result) {
                if(!result.success) {
                    // TODO: show user error.
                    console.log("Could not add favorite!");
                }
            });
        });

        var showFunction = function(title, body, buttonText, buttonClick) {
            $('#ModalTitle').fadeOut(140, function() { $(this).html(title).fadeIn(140)});
            $('#SpeakerButton').html(buttonText);
            var previousHeight = $('#ModalContent')[0].scrollHeight;
            $('#ModalContent').text(body);
            animateHeight(previousHeight);
            $('#SpeakerButton').off("click");
            $('#SpeakerButton').click(buttonClick);
        }

        var showSpeaker = function() {
            showFunction(talk.speaker.name, talk.speaker.bio, talk.title, showTalk);
        };

        var showTalk = function() {
            showFunction(talk.title, talk.subTitle, talk.speaker.name, showSpeaker);
        }

        $('#SpeakerButton').click(showSpeaker)
    }
}