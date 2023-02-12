'use strict';

const db = require.main.require('./src/database');
const utils = require.main.require('./src/utils');

const Vote = require('./vote');
const Scheduler = require('./scheduler');

const Poll = module.exports;

const POLL_DATA_VERSION = 2;

Poll.add = async function (pollData, postData) {
	const pollId = await db.incrObjectField('global', 'nextPollId');

	const poll = {
		pollId: pollId,
		uid: postData.editor || postData.uid,
		tid: postData.tid,
		pid: postData.pid,
		deleted: 0,
		ended: 0,
		timestamp: postData.edited || postData.timestamp,
		version: POLL_DATA_VERSION,
	};

	pollData.options = pollData.options.map((val, i) => ({
		id: i,
		title: val,
	}));

	// async this bitch up
	await Promise.all([
		...pollData.options.map(async (option) => {
			await db.setObject(`poll:${pollId}:options:${option.id}`, option);
			await db.setAdd(`poll:${pollId}:options`, option.id);
		}),
		db.setObject(`poll:${pollId}`, poll),
		db.setObject(`poll:${pollId}:settings`, pollData.settings),
		db.listAppend('polls', pollId),
		db.setObjectField(`topic:${poll.tid}`, 'pollId', pollId),
	]);

	// Check if this poll is scheduled to end
	if (parseInt(pollData.settings.end, 10) > 0) {
		await Poll.schedule(pollId);
	}

	return pollId;
};

Poll.get = async function (pollId, uid, withVotes) {
	const pollData = await utils.promiseParallel({
		info: Poll.getInfo(pollId),
		options: Poll.getOptions(pollId, withVotes),
		settings: Poll.getSettings(pollId),
		hasVoted: uid ? Vote.hasUidVoted(uid, pollId) : Promise.resolve(false),
		vote: uid ? Vote.getUidVote(uid, pollId) : Promise.resolve(null),
	});
	pollData.options.forEach((option) => {
		const percentage = ((option.voteCount / pollData.info.voteCount) * 100).toFixed(0);
		option.percentage = isNaN(percentage) ? 0 : percentage;
	});
	pollData.settings.disallowVoteUpdate = parseInt(pollData.settings.disallowVoteUpdate, 10);
	return pollData;
};

Poll.getPollIdByTid = async function (tid) {
	return await db.getObjectField(`topic:${tid}`, 'pollId');
};

Poll.getPollIdByPid = async function (pid) {
	return await db.getObjectField(`post:${pid}`, 'pollId');
};

Poll.getInfo = async function (pollId) {
	const results = await utils.promiseParallel({
		poll: db.getObject(`poll:${pollId}`),
		voteCount: Poll.getVoteCount(pollId),
	});
	results.poll.voteCount = parseInt(results.voteCount, 10) || 0;
	return results.poll;
};

Poll.getOptions = async function (pollId, withVotes) {
	const options = await db.getSetMembers(`poll:${pollId}:options`);
	return await Promise.all(options.map(option => Poll.getOption(pollId, option, withVotes)));
};

Poll.getOption = async function (pollId, option, withVotes) {
	const results = await utils.promiseParallel({
		option: db.getObject(`poll:${pollId}:options:${option}`),
		votes: withVotes ?
			db.getSortedSetRange(`poll:${pollId}:options:${option}:votes`, 0, -1) :
			Promise.resolve(undefined),
		voteCount: withVotes ?
			Poll.getOptionVoteCount(pollId, option) :
			Promise.resolve(0),
	});
	if (results.votes) {
		results.option.votes = results.votes;
	}
	results.option.voteCount = parseInt(results.voteCount, 10) || 0;

	return results.option;
};

Poll.getVotersCount = async function (pollId) {
	return await db.sortedSetCard(`poll:${pollId}:voters`);
};

Poll.getVoteCount = async function (pollId) {
	const options = await db.getSetMembers(`poll:${pollId}:options`);
	const results = await Promise.all(options.map(option => Poll.getOptionVoteCount(pollId, option)));
	return results.reduce((a, b) => a + b);
};

Poll.getOptionVoteCount = async function (pollId, option) {
	return await db.sortedSetCard(`poll:${pollId}:options:${option}:votes`);
};

Poll.hasOption = async function (pollId, option) {
	return await db.isSetMember(`poll:${pollId}:options`, option);
};

Poll.hasOptions = async function (pollId, options) {
	return await db.isSetMembers(`poll:${pollId}:options`, options);
};

Poll.getSettings = async function (pollId) {
	return await db.getObject(`poll:${pollId}:settings`);
};

Poll.isDeleted = async function (pollId) {
	const result = await Poll.getField(pollId, 'deleted');
	return parseInt(result, 10) === 1;
};

Poll.delete = async function (pollId) {
	return await Poll.setField(pollId, 'deleted', 1);
};

Poll.restore = async function (pollId) {
	return await Poll.setFieldBulk(pollId, {
		edited: 0,
		deleted: 0,
	});
};

Poll.schedule = async function (pollId) {
	await db.setAdd('polls:scheduled', pollId);
	await Scheduler.add(pollId);
};

Poll.getScheduled = async function () {
	return await db.getSetMembers('polls:scheduled');
};

Poll.hasEnded = async function (pollId) {
	const result = await Poll.getField(pollId, 'ended');
	return parseInt(result, 10) === 1;
};

Poll.doesDisallowVoteUpdate = async function (pollId) {
	const result = await Poll.getSettingsField(pollId, 'disallowVoteUpdate');
	return parseInt(result, 10) === 1;
};

Poll.doesAllowVoteUpdate = async function (pollId) {
	const result = await Poll.getSettingsField(pollId, 'disallowVoteUpdate');
	return parseInt(result, 10) !== 1;
};

Poll.end = async function (pollId) {
	await db.setRemove('polls:scheduled', pollId);
	await Poll.setField(pollId, 'ended', 1);
};

Poll.changePid = async function (pollId, pid) {
	return await Promise.all([
		Poll.setField(pollId, 'pid', pid),
		db.setObjectField(`post:${pid}`, 'pollId', pollId),
	]);
};

Poll.changeTid = async function (pollId, tid) {
	return await Promise.all([
		Poll.setField(pollId, 'tid', tid),
		db.setObjectField(`topic:${tid}`, 'pollId', pollId),
	]);
};

Poll.setField = async function (pollId, field, value) {
	return db.setObjectField(`poll:${pollId}`, field, value);
};

Poll.setFieldBulk = async function (pollId, data) {
	return await db.setObjectBulk([`poll:${pollId}`, data]);
};

Poll.getField = async function (pollId, field) {
	return await db.getObjectField(`poll:${pollId}`, field);
};

Poll.getFields = async function (pollId, fields) {
	return await db.getObjectFields(`poll:${pollId}`, fields);
};

Poll.getSettingsField = async function (pollId, field) {
	return await db.getObjectField(`poll:${pollId}:settings`, field);
};

Poll.setSettingsField = async function (pollId, field, value) {
	return await db.setObjectField(`poll:${pollId}:settings`, field, value);
};
