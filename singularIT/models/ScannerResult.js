var mongoose = require('mongoose');
var moment = require('moment');
var Schema = mongoose.Schema;

var ScannerResult = new mongoose.Schema({
    scanner_user:           { type: Schema.Types.ObjectId, ref: 'User',
                              required: true},
    user:                   { type: Schema.Types.ObjectId, ref: 'User',
                              required: true},
    comment:                { type: String, required: false },
    scan_time:              { type: Date, default: Date.now },
    allowed:                { type: Boolean, default: false, required: false}
});

ScannerResult.index({scanner_user: 1, user: 1}, {unique: true});

ScannerResult.virtual('scan_time_string').get(function () {
  return moment(this.scan_time).format('YYYY-MM-DD HH:mm');
});

module.exports = mongoose.model('ScannerResult', ScannerResult);
