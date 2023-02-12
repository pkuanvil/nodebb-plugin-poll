'use strict';

const PluginSockets = require.main.require('./src/socket.io/plugins');
const AdminSockets = require.main.require('./src/socket.io/admin').plugins;

const routeHelpers = require.main.require('./src/routes/helpers.js');

const Config = require('./lib/config');
const Sockets = require('./lib/sockets');
const Hooks = require('./lib/hooks');
const Scheduler = require('./lib/scheduler');

const Plugin = module.exports;

Plugin.hooks = Hooks;

Plugin.load = async function (payload) {
	const { router } = payload;
	function renderAdmin(req, res) {
		res.render(`admin/plugins/${Config.plugin.id}`, {});
	}

	routeHelpers.setupAdminPageRoute(router, `/admin/plugins/${Config.plugin.id}`, [], renderAdmin);

	PluginSockets[Config.plugin.id] = Sockets;
	AdminSockets[Config.plugin.id] = Config.adminSockets;

	await Scheduler.start();
	await Config.init();
	return payload;
};

Plugin.addAdminNavigation = async function (adminHeader) {
	adminHeader.plugins.push({
		route: `/plugins/${Config.plugin.id}`,
		icon: Config.plugin.icon,
		name: Config.plugin.name,
	});
	return adminHeader;
};

Plugin.registerFormatting = async function (payload) {
	payload.options.push({
		name: 'poll',
		className: `fa ${Config.plugin.icon}`,
		title: '[[poll:creator_title]]',
	});
	return payload;
};

Plugin.addPrivilege = async function (hookData) {
	hookData.privileges.set(
		'poll:create', { label: '[[poll:admin.create-poll]]' },
	);
	return hookData;
};

Plugin.copyPrivilegesFrom = async function (data) {
	if (data.privileges.indexOf('poll:create') === -1) {
		data.privileges.push('poll:create');
	}

	if (data.privileges.indexOf('groups:poll:create') === -1) {
		data.privileges.push('groups:poll:create');
	}
	return data;
};
