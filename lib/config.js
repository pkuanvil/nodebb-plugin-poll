'use strict';

const util = require.main.require('node:util');
const Settings = require.main.require('./src/settings');

const packageInfo = require('../package.json');
const pluginInfo = require('../plugin.json');

const pluginId = pluginInfo.id.replace('nodebb-plugin-', '');

const Config = module.exports;

Config.plugin = {
	name: pluginInfo.name,
	id: pluginId,
	version: packageInfo.version,
	description: packageInfo.description,
	icon: 'fa-bar-chart-o',
};

Config.defaults = {
	toggles: {
		allowAnon: false,
	},
	limits: {
		maxOptions: 10,
	},
	defaults: {
		title: 'Poll',
		maxvotes: 1,
		disallowVoteUpdate: 0,
		end: 0,
	},
};

Config.settings = {};

function initCb(__, callback) {
	Config.settings = new Settings(Config.plugin.id, Config.plugin.version, Config.defaults, callback);
}

Config.init = util.promisify(initCb);

Config.adminSockets = {
	sync: function () {
		Config.settings.sync();
	},
	getDefaults: function (socket, data, callback) {
		callback(null, Config.settings.createDefaultWrapper());
	},
};
