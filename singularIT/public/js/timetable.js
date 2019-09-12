const Toast = swal.mixin({
    toast: true,
    position: 'bottom',
    showConfirmButton: false,
    timer: 2000
})

var modal = document.getElementById("talkModal");
var span = document.getElementsByClassName("close")[0];

var i, $mvar = $('.talk-column');
for(i = 0; i < $mvar.length; i++) {
    var id = $mvar.eq(i)[0].dataset["id"];
}

function hideModal() {
    document.getElementById('ModalContent').style.height = null;
    modal.style.display = "none";
}

span.onclick = function() {
    hideModal();
}

window.onclick = function(event) {
    if(event.target == modal) {
        hideModal();
    }
}

$('#enrollFavorites').click(function() {
    $.post("/api/talks/enroll_favorites", {}, function(result) {
        if(result.success) {
            Toast.fire({
                title: 'Success!',
                text: 'Enrolled for all your favorited talks.',
                type: 'success'
            });
        } else {
            if(result.errors > 0) {
                swal.fire({
                    title: 'Error!',
                    text: "Could not enroll for all of your favorites. Enrolled for " + String(result.amountOfFavorites - result.errors) + " talks and failed for " + String(result.errors) + " talks. Did you already enroll for some talks?",
                    type: 'error'
                });
            } else {
                swal.fire({
                    title: 'Error!',
                    text: 'Could not enroll for your favorites. Try again..',
                    type: 'error'
                });
            }
        }
    });
})

$('#favorite-checkbox').change(function() {
    var id = $(this).attr("data-id");
    if($(this).prop("checked") == true) {
        // Register this as favorite.
        $.post("/api/favorite/add/" + id, {}, function(result) {
            if(!result.success) {
                swal.fire({
                    title: 'Error!',
                    text: 'Could not add this talk to your favorites.',
                    type: 'error'
                });
            }
        });
    } else {
        // Unregister this as favorite.
        $.post("/api/favorite/remove/" + id, {}, function(result) {
            if(!result.success) {
                swal.fire({
                    title: 'Error!',
                    text: 'Could not remove this talk from your favorites.',
                    type: 'error'
                });
            }
        });
    }
});

function animateHeight(previousHeight) {
    var element = document.getElementById('ModalContent');
    var sectionHeight = element.scrollHeight;
    var elementTransition = element.style.transition;
    element.style.height = null;

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

function unenrollClick(talkid) {
    $.post("/api/talks/unenroll/" + talkid, {}, function(result) {
        if(result.success) {
            Toast.fire({
                title: 'Success!',
                text: 'Unenrolled for this talk.',
                type: 'success',
            });
        } else {
            Toast.fire({
                title: 'Error!',
                text: 'Could not unenroll for this talk.',
                type: 'error'
            });
        }
    });
}

function enrollClick(talkid) {
    $.post("/api/talks/enroll/" + talkid, {}, function(result) {
        if(result.success) {
            Toast.fire({
                title: 'Success!',
                text: 'Enrolled for this talk.',
                type: 'success',
            });
        } else {
            Toast.fire({
                title: 'Error!',
                text: 'Could not enroll for this talk.',
                type: 'error'
            });
        }
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
        }
    });
    $.get("/api/talks/enrolled/" + talk.id, function(data) {
        if(data.success) {
            var enrollButton = $('#EnrollButton');
            enrollButton.show();

            var showUnenroll = function() {
                enrollButton.html("Unenroll");
                enrollButton.off();
                enrollButton.click(function() {
                    unenrollClick(talk.id);
                    showEnroll();
                });
                enrollButton.removeClass("enroll");
                enrollButton.addClass("unenroll");
            };

            var showEnroll = function () {
                enrollButton.html("Enroll");
                enrollButton.off();
                enrollButton.click(function() {
                    enrollClick(talk.id);
                    showUnenroll();
                } );
                enrollButton.removeClass("unenroll");
                enrollButton.addClass("enroll");
            }

            if(data.enrolled) {
                showUnenroll();
            } else {
                showEnroll();
            }
        } else {
            enrollButton.hide();
        }
    });
    if(talk.speaker) {
        $('#SpeakerButton').html(talk.speaker.name);
        $('#ModalImage').attr('src', talk.speaker.image);

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

        $('#SpeakerButton').off("click");
        $('#SpeakerButton').click(showSpeaker)
    }
}