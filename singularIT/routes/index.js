// var debug = require('debug')('disruptit');
var express = require('express');
var bwipjs = require('bwip-js');
var Ticket = require('../models/Ticket');
var User   = require('../models/User');
var ScannerUser = require('../models/ScannerUser');
var ScannerResult = require('../models/ScannerResult');
var SpeedDateTimeSlot   = require('../models/SpeedDateTimeSlot');
var _      = require('underscore');
var async  = require('async');
var i18n   = require('i18next');
const CSV = require('csv-string');
var moment = require('moment');

// Load speaker information from speakers.json
var fs = require('fs');
var speakerinfo = JSON.parse(fs.readFileSync('speakers.json'));
var partnerinfo = JSON.parse(fs.readFileSync('partners.json'));

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

/**
 * Count the amount of people enrolled for a session and returns object with sessionid
 */
async function countEnrolls(sessionslot, sessionID) {
  var result;
  var query = {};
  query[sessionslot] = sessionID;
  var result = await User.find(query).count()
  return {
    'id' : sessionID,
    'count': result
  }
}

/**
 * Queries the database to get all the visitor counts for non plenary sessions.
 */
async function getVisitorCounts(){
  // Query database to check how many people are going to each session
  promises = [];
  for (var sessionidx = Object.keys(speakerinfo.speakerids).length - 1; sessionidx >= 0; sessionidx--) {
    var session = Object.keys(speakerinfo.speakerids)[sessionidx];
    // Filter out the plenary sessions
    if ( speakerinfo.speakerids[session] instanceof Array) {
      for (var speakeridx = speakerinfo.speakerids[session].length - 1; speakeridx >= 0; speakeridx--) {
        var speaker = speakerinfo.speakerids[session][speakeridx];
        promises.push(countEnrolls(session, speaker));
      }
    }
  }

  // Gather all the data and make a dicht with
  return Promise.all(promises);
}

router.get('/', function (req, res) {
  res.render('index', { title: '', ticketSaleStarts:config.ticketSaleStarts });
});

router.get('/partners', function (req,res) {
  res.render('partners/index',{title:'Partners |', partners: partnerinfo});
});

router.get('/partners/:partner', function (req, res) {
  res.render('partners/'+ req.params.partner, {title: 'Partners - ' + req.params.partner + ' |', path: '/partners'});
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
  var visitorCounts = await getVisitorCounts();


  res.render('profile', {
    userHasBus: config.verenigingen[user.vereniging].bus,
    providePreferences: config.providePreferences,
    speakerids: speakerinfo.speakerids,
    speakers: speakerinfo.speakers,
    matchingterms:config.matchingterms,
    visitorCounts: visitorCounts,
    spTimeSlot: spTimeSlot,
    allSpTimeSlots: allSpTimeSlots,
    freeSpTimeSlots: freeSpTimeSlots,
    provideTrackPreferencesEnd: config.provideTrackPreferencesEnd
  });
});

/**
 * This function is used to determine if there is still room for someone to
 * enroll and takes in to account if someone is already enrolled.
 * TODO: possibly combine with countEnrolls?
 */
async function canEnrollForSession(sessionslot, sessionid, useremail){
  if (Date.now() >= new Date(config.provideTrackPreferencesEnd).getTime()) {
    return false;
  }

  if(typeof sessionid == "undefined" || sessionid == "" || sessionid == null){
    return true;
  }

  var session = speakerinfo.speakers.filter(function(speaker){
    return speaker.id == sessionid;
  });

  // session not found
  if (session.length != 1) {
    return false;
  }

  session = session[0];

  // Check if there is a limit and if so, if it has been reached
  if (session.limit) {
    var query = {};
    query[sessionslot] = sessionid;
    var result;

    await User
      .find(query)
      .where('email')
      .ne(useremail)
      .count()
      .then(function(res){
        result = res;
      });
    return result < session.limit;
  }

  return true;
}

router.post('/profile', auth, async function (req, res) {
  req.sanitize('vegetarian').toBoolean();
  req.sanitize('bus').toBoolean();
  req.sanitize('allowBadgeScanning').toBoolean();

  if(typeof req.body.session1 === 'undefined'){
    req.body.session1 = '';
  }

  if(typeof req.body.session2 === 'undefined'){
    req.body.session2 = '';
  }

  if(typeof req.body.session3 == 'undefined'){
    req.body.session3 = '';
  }


  if(req.body.session1 !== "" && req.body.session1 !== null && !speakerinfo.speakerids.session1.includes(req.body.session1)){
    req.flash('error', "session1 went wrong!");
    return res.redirect('/profile');
  }
  if(req.body.session2 !== "" && req.body.session2 !== null && !speakerinfo.speakerids.session2.includes(req.body.session2)){
    req.flash('error', "session2 went wrong!");
    return res.redirect('/profile');
  }
  if(req.body.session3 !== "" && req.body.session3 !== null && !speakerinfo.speakerids.session3.includes(req.body.session3)){
    req.flash('error', "session3 went wrong!");
    return res.redirect('/profile');
  }

  User.findOne({email:req.session.passport.user}).exec( async function (err, user) {
  if (!err){
/*******************************************************************************
 * There is some form of race condition possible. the check if the session is
 * full can be done after someone else has been checked but before he has been
 * enrolled.
 *
 * Best would be to do a conditional update, however, Mongo does not support
 * this feature in mongo 3.4.
 *
 * For now this is not as big as a problem because one person extra is not
 * that big of a problem. However, watch carefully if people actively abuse
 * this
 ******************************************************************************/

      var canEnrollSession1 = await canEnrollForSession("session1", req.body.session1,
        req.session.passport.user);
      var canEnrollSession2 = await canEnrollForSession("session2", req.body.session2,
        req.session.passport.user);
      var canEnrollSession3 = await canEnrollForSession("session3", req.body.session3,
        req.session.passport.user);

      var tracksClosed = Date.now() >= new Date(config.provideTrackPreferencesEnd).getTime()

      // naar functie zetten en samenvoegen
      if( canEnrollSession1 ){
        user.session1 = req.body.session1;
      } else if(!tracksClosed) {
        req.flash('error', "It is not possible to sign up for the talk you chose for the first session. It's possibly full.");
        err = true;
      }

      if( canEnrollSession2 ){
        user.session2 = req.body.session2;
      } else if(!tracksClosed) {
        req.flash('error', "It is not possible to sign up for the talk you chose for the second session. It's possibly full.");
        err = true;
      }

      if (canEnrollSession3){
        user.session3 = req.body.session3;
      } else if(!tracksClosed) {
        req.flash('error', "It is not possible to sign up for the talk you chose for the third session. It's possibly full.");
        err = true;
      }

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

router.get('/location', function (req, res) {
  res.render('location', {title: 'Location |'});
});
/*
 * Still needs its proper replacement, will come when bus times are available
 * Maybe include in the location or timetable page aswell.
 */
router.get('/buses', function (req, res) {
  res.render('buses', {title: 'Buses | '});
});


router.get('/speakers', function (req, res) {
  var s = speakerinfo.speakers.filter(function(speaker){
    return !speaker.hidden;
  });
  var p = speakerinfo.presenters.filter(function(presenter){
    return !presenter.hidden;
  });
  getVisitorCounts().then(visitorCounts => {
    res.render('speakers/index', {title: 'Speakers | ', speakers: s, presenters: p, speakerids: speakerinfo.speakerids, visitorCounts:visitorCounts});
  });
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
      'usersRegistered': users
    };
  };

  var result = await Promise.all(timeslots.map(createSlot));

  res.render('speeddate', {timeslots: result});
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
      ['Email', 'Name', 'Study programme', 'Comments']
    ];

    var scannerUser = await ScannerUser.findById(req.params.id);

    data.push(await Promise.all((await ScannerResult
      .find({'scanner_user': req.params.id})
      .populate('user')
      .sort({'user.surname': 1, 'user.firstname': 1}))
      .map(async function (r) {
        return [
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
    User.find({vereniging:naam},{firstname:1,surname:1,email:1,bus:1,aanwezig:1},function(err, results) {
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
            config.verenigingen[u.vereniging].name,
            u.bus,
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

router.get('/reload', function (req, res){
  speakerinfo = JSON.parse(fs.readFileSync('speakers.json'));
  partnerinfo = JSON.parse(fs.readFileSync('partners.json'));
  return res.redirect('/speakers');
});

 return router;
};
