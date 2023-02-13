'use strict';

const meta = require.main.require('./src/meta');

const packageInfo = require('../package.json');
const pluginInfo = require('../plugin.json');

// We hardcode this prefix because we do _NOT_ want to change pluginId
const pluginId = pluginInfo.id.replace('@pkuanvil/nodebb-plugin-', '');

const Config = module.exports;

Config.plugin = {
	name: pluginInfo.name,
	id: pluginId,
	version: packageInfo.version,
	description: packageInfo.description,
	icon: 'fa-bar-chart-o',
};

Config.defaults = {
	'toggles.allowAnon': false,
	'limits.maxOptions': 10,
	'defaults.title': 'Poll',
	'defaults.maxvotes': 1,
	'defaults.disallowVoteUpdate': 0,
	'defaults.end': 0,
};

function refSet(data, arr, value) {
	// Don't modify parameter
	let ref = data;
	for (let i = 0; i < arr.length - 1; i++) {
		const key = arr[i];
		if (typeof ref[key] !== 'object') {
			ref[key] = {};
		}
		ref = ref[key];
	}
	const key = arr[arr.length - 1];
	ref[key] = value;
}

function objectify(configData) {
	const result = {};
	for (const [keyLong, value] of Object.entries(configData)) {
		const keyArray = keyLong.split('.');
		refSet(result, keyArray, value);
	}
	return result;
}

async function getMetaWithDefault() {
	const settings = await meta.settings.get(pluginId);
	const result = {};
	// meta settings must have the same type as Config.defaults.
	// We trust poll.tpl to display boolean value as checkbox, other value as text
	for (const field of Object.keys(Config.defaults)) {
		const setting = settings[field];
		const defaultValue = Config.defaults[field];

		if (typeof setting === 'undefined') { // if setting is undefined, use default value
			result[field] = defaultValue;
		} else if (typeof defaultValue === 'boolean') { // For boolean value, don't use default value if not undefined
			result[field] = setting === 'on';
		} else if (typeof defaultValue === 'number') { // For number value, if setting is empty string, use default value
			if (setting === '') {
				result[field] = defaultValue;
			} else {
				const settingNum = parseInt(setting, 10);
				if (isNaN(settingNum)) {
					throw new Error(`Field '${field}' must be a number, get ${setting}`);
				}
				result[field] = settingNum;
			}
		} else {
			result[field] = setting;
		}
	}
	return result;
}

Config.settings = {};

Config.settings.get = async function (key) {
	return (await getMetaWithDefault())[key];
};

Config.settings.getObject = async function () {
	return objectify(await getMetaWithDefault());
};
