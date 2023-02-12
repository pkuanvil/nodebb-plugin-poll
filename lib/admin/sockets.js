'use strict';

const Config = require('../config');

const AdminSockets = module.exports;

AdminSockets.getDefaults = function () {
	return Config.defaults;
};
