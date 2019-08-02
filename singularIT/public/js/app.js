particlesJS.load('particles-js', 'assets/particlejs.json', function() {
});

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

var SILVER_LOGO_DURATION = 5000;

var silver_logos = Array();
silver_logos.push("/images/partners/logo_ORTEC_oyw.png");
silver_logos.push("/images/partners/logo_Quintor.jpg");

silver_logos = shuffle(silver_logos);
var silver_logos_iter = 0;

function changeSilverSponsorImage() {
  // var random_logo = silver_logos[Math.floor(Math.random() * silver_logos.length)];
  var logo = silver_logos[silver_logos_iter];
  $("#silver_logos").fadeOut(250, function() {
    $("#silver_logos").attr("src", logo);
    $("#silver_logos").fadeIn(250);
  });

  silver_logos_iter += 1;
  if (silver_logos_iter >= silver_logos.length) {
    silver_logos_iter = 0;
  }
}

changeSilverSponsorImage();
window.setInterval(function(){
  changeSilverSponsorImage();
}, SILVER_LOGO_DURATION);



$("#navbarToggle").on('click', function() {
  $("#navbar-main-collapse").toggle();
});


// Adds scroll animations to all local links. First checks whether this link goes to the current page.
$('i,a[href^="/#"]').on('click', function(event) {
  var hrefAttr = this.getAttribute('href');
  var compare = hrefAttr.split('/#')[0] + '/'
  if(window.location.pathname === compare) {
    var target = $(hrefAttr.substring(1, hrefAttr.length));
    if( target.length ) {
        event.preventDefault();
        $('html, body').stop().animate({
            scrollTop: target.offset().top - $(window).height() * 0.05
        }, 1000);
    }
  }
});

$('i,a[href^="#"]').on('click', function(event) {
    var target = $(this.getAttribute('href'));
    if( target.length ) {
        event.preventDefault();
        $('html, body').stop().animate({
            scrollTop: target.offset().top - $(window).height() * 0.05
        }, 1000);
    }
});
