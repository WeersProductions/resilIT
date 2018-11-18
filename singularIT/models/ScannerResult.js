var mongoose = require('mongoose');
var moment = require('moment');
var Schema = mongoose.Schema;

var ScannerResult = new mongoose.Schema({
    scanner_user:           { type: Schema.Types.ObjectId, ref: 'ScannerUser',
                              required: true, index: true },
    user:                   { type: Schema.Types.ObjectId, ref: 'User',
                              required: true, index: true },
    comment:                { type: String, required: false },
    scan_time:              { type: Date, default: Date.now }
});

ScannerResult.index({scanner_user: 1, user: 2});

ScannerResult.virtual('scan_time_string').get(function () {
  return moment(this.scan_time).format('YYYY-MM-DD HH:mm');
});

module.exports = mongoose.model('ScannerResult', ScannerResult);
