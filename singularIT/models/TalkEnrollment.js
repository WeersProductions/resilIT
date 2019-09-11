var mongoose = require('mongoose');

var TalkEnrollment = new mongoose.Schema({
    user : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    talk : { type: Number, required: true }
  });

TalkEnrollment.index({user:1, talk:1}, {unique:true});

var model = mongoose.model('TalkEnrollment', TalkEnrollment);

module.exports = model;
