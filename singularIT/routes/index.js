// var debug = require('debug')('disruptit');
var express = require('express');
var bwipjs = require('bwip-js');
var Ticket = require('../models/Ticket');
var User   = require('../models/User');
var TalkEnrollment = require('../models/TalkEnrollment');
var ScannerUser = require('../models/ScannerUser');
var ScannerResult = require('../models/ScannerResult');
var SpeedDateTimeSlot   = require('../models/SpeedDateTimeSlot');
var _      = require('underscore');
var async  = require('async');
var i18n   = require('i18next');
const CSV = require('csv-string');
var moment = require('moment');

function loadTimetableJSON(speakers) {
  var dateTimeSettings = {hour:'2-digit', minute:'2-digit', hour12:false};

  var tmtble = JSON.parse(fs.readFileSync('timetable.json'));
  var intervalInMs = tmtble.timeInterval * 60 * 1000;

  // Add time intervals to be used in the webpage.
  var startTime = new Date(tmtble.date + tmtble.startTime);
  var endTime = new Date(tmtble.date + tmtble.endTime);
  var intervalAmount = Math.abs(endTime - startTime) / intervalInMs;
  var intervals = []
  for(var i = 0; i <= intervalAmount; i++) {
    var date = new Date(startTime.getTime() + i * intervalInMs);
    date = date.toLocaleTimeString("en-GB", dateTimeSettings)
    intervals.push(date);
  }
  tmtble.intervals = intervals;

  all_talks = []

  for(var track in tmtble.tracks) {
    for(var talk in tmtble.tracks[track].talks) {
      talk = tmtble.tracks[track].talks[talk];
      // Add the length in multiple of 15 minutes. (30 min talk = 2)
      talk.startTime = new Date(tmtble.date + talk.startTime);
      talk.endTime = new Date(tmtble.date + talk.endTime);
      talk.startTimeDisplay = talk.startTime.toLocaleTimeString("en-GB", dateTimeSettings);
      talk.endTimeDisplay = talk.endTime.toLocaleTimeString("en-GB", dateTimeSettings);
      talk.length = Math.abs(talk.endTime - talk.startTime) / intervalInMs;
      if(talk.speakerId) {
        talk.speaker = speakers.speakers.find(item=>item.id==talk.speakerId);
      }
      all_talks.push(talk);
      talkCapacity[talk.id] = talk.capacity;
    }
  }
  for(var track in tmtble.tracks) {
    for(var talk in tmtble.tracks[track].talks) {
      talk = tmtble.tracks[track].talks[talk];
      simultaneous = [];
      for(var other_talk in all_talks) {
        if (other_talk == talk) {
          continue;
        }
        other_talk = all_talks[other_talk]
        if (talk.startTime >= other_talk.startTime && talk.startTime < other_talk.endTime) {
          simultaneous.push(other_talk.id);
        } else if(talk.endTime > other_talk.startTime && talk.endTime <= other_talk.endTime) {
          simultaneous.push(other_talk.id);
        }
      }
      talk.simultaneous = simultaneous;
    }
  }
  return tmtble;
}

// Load speaker information from speakers.json
var fs = require('fs');
var talkCapacity = {};
var speakerinfo = JSON.parse(fs.readFileSync('speakers.json'));
var partnerinfo = JSON.parse(fs.readFileSync('partners.json'));
var timetable = loadTimetableJSON(speakerinfo);

module.exports = function (config) {
var router = express.Router();


function auth(req, res, next) {
  if (!req.user) {
    req.session.lastPage = req.path;
    req.flash('info', 'You have to log in to visit page ' + req.path );
    return res.redirect('/login');
  }
  next();
}

function adminAuth(req, res, next) {
  if (!req.user || !req.user.admin) {
    req.session.lastPage = req.path;
    req.flash('info', 'You have to log in to visit page ' + req.path );
    return res.redirect('/login');
  }
  next();
}

async function countEnrolls(sessionId){
  let result;
  await TalkEnrollment.count({talk: sessionId}, function (err, count) {
    if (err) {
      result = {success: false};
    } else {
      result = {success: true, capacity: count};
    }
  });
  return result;
}

async function canEnrollForSession(sessionId) {
  var enrollInfo = await countEnrolls(sessionId);
  if(!enrollInfo.success) {
    return {success: false, message:"Could not find talk."};
  }
  if(enrollInfo.capacity >= talkCapacity[sessionId]) {
    return {success: false, message:"Talk is full."};
  }
  return {success: true};
}

/**
 * Count the amount of people enrolled for a session and returns object with sessionid
 */
// async function countEnrolls(sessionslot, sessionID) {
//   var result;
//   var query = {};
//   query[sessionslot] = sessionID;
//   var result = await User.find(query).count()
//   return {
//     'id' : sessionID,
//     'count': result
//   }
// }

/**
 * Queries the database to get all the visitor counts for non plenary sessions.
 */
// async function getVisitorCounts(){
//   // Query database to check how many people are going to each session
//   promises = [];
//   for (var sessionidx = Object.keys(speakerinfo.speakerids).length - 1; sessionidx >= 0; sessionidx--) {
//     var session = Object.keys(speakerinfo.speakerids)[sessionidx];
//     // Filter out the plenary sessions
//     if ( speakerinfo.speakerids[session] instanceof Array) {
//       for (var speakeridx = speakerinfo.speakerids[session].length - 1; speakeridx >= 0; speakeridx--) {
//         var speaker = speakerinfo.speakerids[session][speakeridx];
//         promises.push(countEnrolls(session, speaker));
//       }
//     }
//   }

//   // Gather all the data and make a dicht with
//   return Promise.all(promises);
// }

router.get('/', function (req, res) {
  res.render('index', { title: '', ticketSaleStarts:config.ticketSaleStarts });
});

router.get('//', function (req, res) {
  res.render('index', { title: '', ticketSaleStarts:config.ticketSaleStarts });
});

router.get('/partners', function (req,res) {
  res.render('partners/index',{title:'Partners |', partners: partnerinfo});
});

router.get('/partners/:partner',  function (req, res) {
  res.render('partners/partner', {partner: partnerinfo.partners[req.params.partner]});
});

router.get('/profile', auth, async function (req, res) {
  var user = await User.findOne({email:req.session.passport.user});
  var spTimeSlot = null;
  var allSpTimeSlots = null;
  var freeSpTimeSlots = null;

  if (user.speedDateTimeSlot) {
    spTimeSlot = await SpeedDateTimeSlot.findById(user.speedDateTimeSlot);
  } else {
    allSpTimeSlots = await SpeedDateTimeSlot.find().sort({'startTime':1});

    allSpTimeSlots = await Promise.all(allSpTimeSlots.map(
      async function (ts) {
        var userCount = await User.find(
          {speedDateTimeSlot: ts.id}).count();

        ts.isFree = userCount < ts.capacity;

        return ts;
      }));

      freeSpTimeSlots = allSpTimeSlots.filter(ts => ts.isFree);
  }

  // Don't try to unescape here, it's not stored in user.
  // Do it in the template
  // var visitorCounts = await getVisitorCounts();

  res.render('profile', {
    userHasBus: config.verenigingen[user.vereniging].bus,
    providePreferences: config.providePreferences,
    speakerids: speakerinfo.speakerids,
    speakers: speakerinfo.speakers,
    matchingterms:config.matchingterms,
    spTimeSlot: spTimeSlot,
    allSpTimeSlots: allSpTimeSlots,
    freeSpTimeSlots: freeSpTimeSlots,
    provideTrackPreferencesEnd: config.provideTrackPreferencesEnd
  });
});

router.get('/api/user', auth, async function (req, res) {
  var user = await User.findOne({email:req.session.passport.user});
  res.json(user);
});


if(config.starthelper && config.starthelper.url) {
  router.post('/api/' + config.starthelper.url, async function(req, res) {
    var tmpconfig = JSON.parse(fs.readFileSync('config.json'));
    if(tmpconfig.starthelper.active) {
      params = {rev: 1};
      var ticket = new Ticket(params);
      var ticket_id = ticket._id;
      ticket.save(function(err) {
        if(err) {
          return res.json({"success": false, "error": err});
        } else {
          return res.json({"success": true, "ticket_id": ticket_id});
        }
      });
    } else {
      return res.json({"success": false});
    }
  });
  router.post('/api/' + config.starthelper.url +"/:username", async function(req, res) {
    var tmpconfig = JSON.parse(fs.readFileSync('config.json'));
    if(tmpconfig.starthelper.active) {
      var user = await User.findOne({email:req.params.username});
      user.admin = true;
      user.save(function(err) {
        if(err) {
          res.json({"success": false, "user": user});
        } else {
          res.json({"success": true, "user": user});
        }
      });
    } else {
      res.json({"success": false});
    }
  });
}

/**
 * Enroll for a talk for this user.
 */
router.post('/api/talks/enroll/:id', auth, async function(req, res) {
  User.findOne({email:req.session.passport.user}).exec(async function (err, user) {
    if(err) {
      res.json({success: false, message:"Could not find user"});
    } else {
      canEnrollInfo = await canEnrollForSession(req.params.id);
      if(!canEnrollInfo.success) {
        res.json({success: false, message: canEnrollInfo.message});
        return;
      }
      var newTalkEnrollment = new TalkEnrollment({
        user: user,
        talk: req.params.id
      });
      newTalkEnrollment.save(
        // function(err) {
        // if(err) {
        //   res.json({success: false});
        // } else {
        //   res.json({success: true});
        // }
      // }
      ).then(function(document) {
        console.log(document);
      });
    }
  });
});

router.post('/api/talks/unenroll/:id', auth, async function(req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if(err) {
      res.json({"success": false});
    } else {
      TalkEnrollment.deleteOne({user: user, talk: req.params.id}, function(err) {
        if(err) {
          res.json({"success": false});
        } else {
          res.json({"success": true});
        }
      });
    }
  });
});

/**
 * Enroll for all favorites of the user.
 */
router.post('/api/talks/enroll_favorites', auth, async function(req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if(err) {
      res.json({success: false});
    } else {
      var amountOfFavorites = user.favorites.length;
      var errors = 0;
      for (var i = 0; i < amountOfFavorites; i++) {
        canEnrollInfo = await canEnrollForSession(user.favorites[i]);
        if(!canEnrollInfo.success) {
          errors += 1;
          continue;
        }
        var newTalkEnrollment = new TalkEnrollment({
          user: user,
          talk: user.favorites[i]
        });
        await newTalkEnrollment.save(function(err) {
          if(err) {
            errors += 1;
          }
        });
      }
      if(errors > 0) {
        res.json({success: false, errors, amountOfFavorites});
      } else {
        res.json({success: true});
      }
    }
  });
});

/**
 * Get all talks this user is enrolled for.
 */
router.get('/api/talks/', auth, async function(req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    TalkEnrollment.find({user: user}).exec(async function (err, talks) {
      if(err) {
        res.json({success: false});
      } else {
        res.json({success: true, talks: talks});
      }
    });
  });
});

router.get('/api/talks/enrolled/:id', auth, async function(req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if(err) {
      res.json({success: false});
    } else {
      TalkEnrollment.findOne({user: user, talk: req.params.id}, function(err, result) {
        if(err) {
          res.json({success: false});
        } else {
          var enrolled = true;
          if(!result) {
            enrolled = false;
          }
          res.json({success: true, enrolled: enrolled})
        }
      });
    }
  });
})

router.get('/api/talks/capacity/:id', auth, async function(req, res) {
  TalkEnrollment.count({talk: req.params.id}, function (err, count) {
    if (err) {
      res.json({success: false});
    } else {
      res.json({success: true, capacity: count});
    }
  })
})

/**
 * Add a favorite talk to the user.
 */
router.post('/api/favorite/add/:id', auth, async function (req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if (!err){
      if(!user.favorites) {
        user.favorites =[];
      }
      user.favorites.push(req.params.id);
      user.save();
      res.json({"success": true});
    } else {
      res.json({"success": false, "message": "Could not find user!"});
    }
  });
});

/**
 * Remove a favorite from the current user.
 */
router.post('/api/favorite/remove/:id', auth, async function (req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if (!err){
      if(user.favorites) {
        for( var i = user.favorites.length; i--;){
            if ( user.favorites[i] == req.params.id) user.favorites.splice(i, 1);
        }
        user.save();
      }

      res.json({"success": true});
    } else {
      res.json({"success": false, "message": "Could not find user!"});
    }
  });
});

/**
 * Remove all favorites from the user.
 */
router.post('/api/favorite/remove', auth, async function (req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if (!err){
      user.favorites = [];

      user.save();
      res.json({"success": true});
    } else {
      res.json({"success": false, "message": "Could not find user!"});
    }
  });
});

/**
 * Get all favorites of this user.
 */
router.get('/api/favorite', auth, async function (req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if (!err){
      res.json({"success": true, "favorite": user.favorites});
    } else {
      res.json({"success": false, "message": "Could not find user!"});
    }
  });
});

/**
 * Check if a talk is a favorite.
 */
router.get('/api/favorite/:id', auth, async function (req, res) {
  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
    if (!err){
      res.json({"success": true, "favorite": user.favorites.includes(parseInt(req.params.id))});
    } else {
      res.json({"success": false, "message": "Could not find user!"});
    }
  });
})

router.post('/profile', auth, async function (req, res) {
  req.sanitize('vegetarian').toBoolean();
  req.sanitize('bus').toBoolean();
  req.sanitize('allowBadgeScanning').toBoolean();

  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
  if (!err){
      user.vegetarian   = req.body.vegetarian ? true : false;
      user.bus          = req.body.bus ? true : false;
      user.specialNeeds = req.body.specialNeeds;
      user.allowBadgeScanning  = req.body.allowBadgeScanning ? true: false;

      if (req.body.speedDateTimeSlot) {
        var spTimeSlot = await SpeedDateTimeSlot.findById(req.body.speedDateTimeSlot);
        if (!spTimeSlot) {
          req.flash('error', "Invalid speed date timeslot chosen");
          err = true;
        } else {

          var userCount = await User.find({speedDateTimeSlot: spTimeSlot.id}).count();

          if (userCount >= spTimeSlot.capacity) {
            req.flash('error', "The speed date timeslot you chose is already full.");
            err = true;
          } else {
            user.speedDateTimeSlot = spTimeSlot.id;
          }

        }
      }


      var matching = [];
      for (var i = 0; i < config.matchingterms.length; i++) {
        if (req.body[config.matchingterms[i]]){
          matching.push(config.matchingterms[i]);
        }
      }
      user.matchingterms = matching;
      user.save();

      if(!err){
        req.flash('success', 'Profile edited');
      }
      res.redirect('/profile');
    } else {
      // debug(err);
      console.log(err);
      req.flash('error', 'Something went wrong!');
      res.redirect('/profile');
    }
  });
});

router.get('/location', adminAuth, function (req, res) {
  res.render('location', {title: 'Location |'});
});
/*
 * Still needs its proper replacement, will come when bus times are available
 * Maybe include in the location or timetable page aswell.
 */
router.get('/buses', adminAuth, function (req, res) {
  res.render('buses', {title: 'Buses | '});
});


router.get('/speakers', function (req, res) {
  var s = speakerinfo.speakers.filter(function(speaker){
    return !speaker.hidden;
  });
  var p = speakerinfo.presenters.filter(function(presenter){
    return !presenter.hidden;
  });
  res.render('speakers/index', {speakers: s, presenters: p, speakerids: speakerinfo.speakerids, settings: {tracks: speakerinfo.tracks, showTrackNames: speakerinfo.showTrackNames}});
});

router.get('/users', adminAuth, function (req,res,next) {
  var query = {};

  if (req.query.email) {
    query.email = { $regex: new RegExp(req.query.email, 'i') };
  }
  if (req.query.firstname) {
    query.firstname = { $regex: new RegExp(req.query.firstname, 'i') };
  }
  if (req.query.surname) {
    query.surname = { $regex: new RegExp(req.query.surname, 'i') };
  }
  if (req.query.vereniging) {
    query.vereniging = { $regex: new RegExp(req.query.vereniging, 'i') };
  }
  if (req.query.ticket) {
    query.ticket = { $regex: new RegExp(req.query.ticket, 'i') };
  }
  if (req.query.aanwezig) {
    query.aanwezig = { $regex: new RegExp(req.query.aanwezig, 'i') };
  }

  User.find(query).sort({'vereniging':1,'firstname':1}).exec( function (err, results) {
    if (err) { return next(err); }
    res.render('users',{users:results, verenigingen:config.verenigingen});
  });
});

router.get('/speeddate', adminAuth, async function (req, res) {
  var timeslots = await SpeedDateTimeSlot.find().sort({'startTime':1});

  var createSlot = async function (slot) {
    var users = await User.find({'speedDateTimeSlot': slot.id});
    return {
      'name': slot.name,
      'capacity': slot.capacity,
      'usersRegistered': users,
      'id': slot.id
    };
  };

  var result = await Promise.all(timeslots.map(createSlot));

  res.render('speeddate', {timeslots: result});
});

router.get('/admin', adminAuth, async function(req, res) {
  res.render('admin');
});

router.get('/speeddate/export-csv', adminAuth,
  async function (req, res) {
    var data = [
      ['Slot', 'Name', 'Email', 'Study programme', 'Association']
    ];

    var slots = await SpeedDateTimeSlot.find().sort({'startTime':1})

    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];

      var users = await User.find({'speedDateTimeSlot': slot.id});
      var userData = users.map(user => [
        slot.name, user.firstname + ' ' + user.surname, user.email, user.studyProgramme, config.verenigingen[user.vereniging].name
      ])

      if (userData.length > 0) {
        data.push(userData);
      }
    }

    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="speeddating_participants.csv"');
    res.send(CSV.stringify(data));
  }
);

router.get('/speeddate/remove/:id', adminAuth, async function(req, res) {
  console.log('Removing speeddate: ' + req.params.id);
  res.redirect('/speeddate');
});

router.get('/badge-scanning', adminAuth, async function (req, res) {
  var badgeScanningAllowed = await User.find(
    {'allowBadgeScanning': true, 'type': 'student'}).count();
  var totalUsers = await User.find({'type': 'student'}).count();

  var scannerAccounts =
    await Promise.all((await ScannerUser.find().sort({'displayName': 1})).map(
      async function (account) {
        var scans = await ScannerResult
          .find({'scanner_user': account._id})
          .populate('user')
          .sort({'user.studyProgramme': 1});

        return {
          'id': account._id,
          'display_name': account.display_name,
          'username': account.username,
          'scans': scans
        };
      }
    ));

  res.render('badge_scanning', {
    badgeScanningAllowed: badgeScanningAllowed,
    totalUsers: totalUsers,
    scannerAccounts: scannerAccounts,
    associations: config.verenigingen
  });
});

router.get('/badge-scanning/export-csv/:id', adminAuth,
  async function (req, res) {
    var data = [
      ['Time', 'Email', 'Name', 'Study programme', 'Comments']
    ];

    var scannerUser = await ScannerUser.findById(req.params.id);

    data.push(await Promise.all((await ScannerResult
      .find({'scanner_user': req.params.id})
      .populate('user')
      .sort({'user.surname': 1, 'user.firstname': 1}))
      .map(async function (r) {
        return [
          r.scan_time_string,
          r.user.email,
          r.user.firstname + ' ' + r.user.surname,
          r.user.studyProgramme,
          r.comment
        ];
      })));

    var filename = scannerUser.display_name.replace(/ /g, '_')
          + '_badge_scans.csv';

    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(CSV.stringify(data));
  }
);

/**
 * Output all dietary wishes provided by users
 */
router.get('/diet', adminAuth, function (req, res, next) {
  User.find({$or: [{'specialNeeds': {$ne: ""}}, {'vegetarian': true}]}).sort({'vereniging':1,'firstname':1}).exec( function (err, results) {
    if (err) { return next(err); }
    res.render('diet',{users:results, verenigingen:config.verenigingen});
  });
});

router.get('/users/:id', adminAuth, function (req,res,next) {
  User.findOne({_id:req.params.id}, function (err, result) {
    if (err) { return next(err); }
    res.render('users/edit', {user:result});
  });
});

router.post('/users/:id', adminAuth, function (req,res,next) {
  User.findOne({_id:req.params.id}, function (err, result) {
    if (err) { return next(err); }

    result.aanwezig = req.body.aanwezig;
    result.admin = req.body.admin;

    result.save(function(err) {
      if (err) {return next(err); }

      req.flash('success', "User edited!");
      return res.redirect('/users/'+req.params.id);
    });
  });
});

router.post('/aanmelden', adminAuth, async function (req, res) {
  var ticket = req.body.ticket;
  var user = await User.findOne({ticket:ticket}).populate('speedDateTimeSlot');

  if (!user) {
    req.flash('error', "Ticket not found. Try finding it manually." );
    return res.redirect('/users');
  }

  if (user.aanwezig) {
    req.flash('error', "This ticket is already marked as present.");
    return res.redirect('/users');
  }

  user.aanwezig = true;

  await user.save();

  req.flash('success', res.locals.ucfirst(user.firstname) + ' ' + user.surname
    +' ('+ res.locals.verenigingen[user.vereniging].name +') has registered his ticket');

  if (user.speedDateTimeSlot) {
    req.flash('warning', '!safe:The user has registered for speed dating in slot: <b>'
      + user.speedDateTimeSlot.name + '</b>.');
  }

  res.redirect('/users');
});

/**
 * List of people present, per association
 */
router.get('/aanwezig', adminAuth, function (req,res,next) {
  var namen = _.keys(config.verenigingen);

  var findTickets = function (naam,cb) {
    User.find({vereniging:naam},{firstname:1,surname:1,email:1,bus:1,aanwezig:1,companyName:1},function(err, results) {
      if (err) { return cb(err); }

      cb(null, {name:naam, rows:results});
    });
  };
  async.map(namen, findTickets, function (err, result) {
    if (err) { return next(err); }
    res.render('aanwezig', { tables : result });
  });
});

router.get('/users/export-csv/all', adminAuth,
  async function (req, res) {
    var data = [
      ['First Name', 'Surname', 'Email', 'Bus', 'Association', 'Ticket code',
        'Session 1', 'Session 2', 'Session 3', 'Speeddate start', 'Speeddate end']
    ];

    data.push(await Promise.all(
      (await User.find().sort([['firstname', 1], ['lastname', 1]]).populate('speedDateTimeSlot'))
        .map(async function (u) {
          var session1 = u.session1 ? u.session1 : "";
          var session2 = u.session2 ? u.session2 : "";
          var session3 = u.session3 ? u.session3 : "";

          var spStart = "";
          var spEnd = "";

          if (u.speedDateTimeSlot) {
            spStart = moment(u.speedDateTimeSlot.startTime).format('HH:mm')
            spEnd = moment(u.speedDateTimeSlot.endTime).format('HH:mm')
          }

          return [
            u.firstname,
            u.surname,
            u.email,
            u.bus,
            config.verenigingen[u.vereniging].name,
            u.ticket,
            session1,
            session2,
            session3,
            spStart,
            spEnd
          ];
      }))
    );

    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="all_registered_users.csv"');
    res.send(CSV.stringify(data));
});

router.get('/users/export-csv/:association', adminAuth, async function (req, res) {
    var data = [
      ['First Name', 'Surname', 'Email', 'Bus', 'Ticket code']
    ];

    var association = config.verenigingen[req.params.association];
    if (!association) {
        req.flash('error', 'Association does not exist');
        return res.redirect('/users');
    }
    var associationName = association.name;

    data.push(await Promise.all(
      (await User.find({'vereniging': req.params.association}))
      .map(async function (u) {
        return [
          u.firstname,
          u.surname,
          u.email,
          u.bus,
          u.ticket
        ];
      })));

    var filename = associationName.replace(/ /g, '_')
          + '_registered_users.csv';

    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(CSV.stringify(data));
});

/*******************************************************************************
 * Triggered if someone requests this page. This will be printed on the badge of
 * an attendee in the form of a QR code. Can be scanned with generic QR code
 * scanners. When url has been gotten, can be opened in browser.
 *
 * Will create a list of all people to connected with during the event per user.
 * After the event, this can be used to send an email to everyone who
 * participated to exchange contact details.
 ******************************************************************************/
router.get('/connect/:id', auth, function(req, res, next){
  User.findOne({ticket: req.params.id}, function(err, user){
    if (err || !user) {
      // debug(err);
      res.render('connect', {connected: false, error: 'Ticket id is not valid'});
    } else {
      User.findOneAndUpdate({email:req.session.passport.user}, {$addToSet: {connectlist: req.params.id}},function(err, doc){
        if(err){
          res.render('connect', {connected: false, error: 'Could not connect with ' + user.firstname});
          console.log(req.params.id + "could not be added to the connectlist!");
        } else {
          res.render('connect', {connected: true, connectee: user});
        }
      });
    }
  })
});

/**
 * Session choices displayed for administrators
 */
router.get('/choices', adminAuth, function (req,res,next) {
  var opts = {reduce: function(a,b){ b.total++;}, initial: {total: 0}};



  User.aggregate([{ $group: { _id: '$session1', count: {$sum: 1} }}], function (err, session1) {
    User.aggregate([{ $group: { _id: '$session2', count: {$sum: 1} }}], function (err, session2) {
      User.aggregate([{ $group: { _id: '$session3', count: {$sum: 1} }}], function (err, session3) {
        res.render('choices', { session1 : session1, session2 : session2, session3 : session3  });
      });
    });
  });
});


async function getMatchingStats(){
  // based on https://github.com/Automattic/mongoose/blob/master/examples/mapreduce/mapreduce.js
  var map = function(){
    for (var i = this.matchingterms.length - 1; i >= 0; i--) {
      emit(this.matchingterms[i], 1)
    }
  }

  var reduce = function(key, values){
    return Array.sum(values);
  }

  // map-reduce command
  var command = {
    map: map, // a function for mapping
    reduce: reduce, // a function  for reducing
  };

  return User.mapReduce(command);
}

router.get('/matchingstats', adminAuth, function(req,res,next){
  getMatchingStats().then(results =>{
    console.log(results);
    res.render('matchingstats', {interests: results});
  }).catch(function(err){
    res.render('matchingstats', {error: err});
  });
});

/**
 * Output alle tickets die nog niet geownt zijn door gebruikers
 */
router.get('/tickets', adminAuth, function (req, res, next) {
  Ticket.find({rev:1, ownedBy:undefined}, function (err, tickets) {
    if (err) { return next(err); }
    res.render('tickets', {tickets: tickets});
  });
});

router.post('/tickets', adminAuth, function (req, res, next) {
  var tasks = [];

  var n = + req.body.amount;

  for (var i = 0; i < n; i++) {
    tasks.push(function(callback) {
      var params;
      if (req.body.type === 'partner'){
        params = {type: process.argv[3], rev:1};
      } else {
        params = {rev:1};
      }
      var ticket = new Ticket(params);
      console.log('New ticket: '+ticket._id);

      return ticket.save(callback);
    });
  }

  async.parallel(tasks, function(err) {
    if (err) {
      console.log(err);
    }
    console.log(n + ' tickets generated!');
    res.redirect('/tickets');
  });
})

router.post('/speeddate', adminAuth, function(req, res, next) {
  console.log('Creating ' + req.body.startTime + '-' + req.body.endTime);

  var ts = new SpeedDateTimeSlot({
    startTime: '2019-11-26T' + req.body.startTime,
    endTime: '2019-11-26T' + req.body.endTime,
    capacity: req.body.capacity
  });
  ts.save().then(function(doc) {
    console.log('Created speeddate time slot!');
    return res.redirect('/speeddate');
  },function(err) {
      console.log(err);
      return next(error);
  });
})

router.get('/api/timetable', adminAuth, function(req, res, next) {
  res.json(timetable);
})

router.get('/timetable', adminAuth, function(req, res) {
  var enrollment_start_time = new Date(config.enroll_start_time);
  var enrollment_end_time = new Date(config.enroll_end_time);
  var today = new Date();
  var enrollment_possible = enrollment_start_time < today && today < enrollment_end_time;
  var show_capacity = today > enrollment_start_time;

  res.render('timetable', {timetable: timetable, enrollment_possible: enrollment_possible, show_capacity});
})

router.get('/ticket', auth, function(req, res, next){
  User.findOne({email: req.session.passport.user}, function(err, doc) {
    res.redirect('/tickets/' + doc.ticket);
  });
});

router.get('/tickets/:id', auth, function (req, res, next) {
  Ticket.findById(req.params.id).populate('ownedBy').exec(function (err, ticket) {
    if (err) { err.code = 403; return next(err); }
    if (!ticket || !ticket.ownedBy || ticket.ownedBy.email !== req.session.passport.user) {
      var error = new Error("Forbidden");
      error.code = 403;
      return next(error);
    }
    res.render('tickets/ticket', {ticket: ticket});
  });
});

router.get('/tickets/:id/barcode', function (req, res) {
    bwipjs.toBuffer({
        bcid: 'code128',
        text: req.params.id,
        height: 10,
    }, function (err, png) {
        if (err) {
            return next(err);
        } else {
            res.set('Content-Type', 'image/png');
            res.send(png);
        }
    });
});

router.get('/reload', adminAuth, function (req, res){
  speakerinfo = JSON.parse(fs.readFileSync('speakers.json'));
  partnerinfo = JSON.parse(fs.readFileSync('partners.json'));
  timetable = loadTimetableJSON(speakerinfo);
  return res.redirect('/speakers');
});

router.get('/reload/:file', adminAuth, function (req, res) {
  if (req.params.file==='speakers') {
    speakerinfo = JSON.parse(fs.readFileSync('speakers.json'));
    return res.redirect('/speakers');
  } else if(req.params.file==='partners') {
    partnerinfo = JSON.parse(fs.readFileSync('partners.json'));
    return res.redirect('/partners');
  } else if(req.params.file ==='timetable') {
    timetable = loadTimetableJSON(speakerinfo);
    return res.redirect('/timetable');
  }
  return res.redirect('/');
})

 return router;
};
