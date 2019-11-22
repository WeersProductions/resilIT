var mongoose = require('mongoose');

var QRLink = new mongoose.Schema({
    user : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    qr : { type: String, required: true }
  });

  QRLink.index({user:1, qr:1}, {unique:true});

var model = mongoose.model('QRLink', QRLink);

module.exports = model;
