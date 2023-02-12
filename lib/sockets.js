'use strict';

const Posts = require.main.require('./src/posts');
const Privileges = require.main.require('./src/privileges');
const SocketIndex = require.main.require('./src/socket.io/index');
const Topics = require.main.require('./src/topics');
const User = require.main.require('./src/user');
const utils = require.main.require('./src/utils');

const Config = require('./config');
const Poll = require('./poll');
const Vote = require('./vote');

const Sockets = module.exports;

Sockets.get = async function (socket, data) {
	if (!data) {
		throw new Error('Invalid request, request data is not defined');
	}
	const pollId = parseInt(data.pollId, 10);
	if (isNaN(pollId)) {
		throw new Error('Invalid request, pollId is required');
	}
	if ((!socket.uid && !Config.settings.get('toggles.allowAnon'))) {
		throw new Error('Invalid request, anonymous access is not allowed');
	}

	const pollData = await Poll.get(pollId, socket.uid, !!socket.uid);
	if (!pollData.info.version) {
		throw new Error('Legacy polls are not supported');
	}
	pollData.optionType = parseInt(pollData.settings.maxvotes, 10) > 1 ? 'checkbox' : 'radio';

	return pollData;
};

Sockets.vote = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('You need to be logged in to vote');
	}
	if (!data || isNaN(parseInt(data.pollId, 10)) || !data.options || !data.options.length) {
		throw new Error('Invalid vote');
	}

	data.uid = socket.uid;

	const result = await utils.promiseParallel({
		canVote: Vote.canVote(data.uid, data.pollId),
		optionsFilter: Poll.hasOptions(data.pollId, data.options),
		settings: Poll.getSettings(data.pollId),
	});

	// Filter the options on their existence
	data.options = data.options.filter((el, index) => result.optionsFilter[index]);
	// Give an error if there are too many votes
	if (data.options.length > parseInt(result.settings.maxvotes, 10)) {
		throw new Error(`You can only vote for ${result.settings.maxvotes} options on this poll.`);
	}

	if (!result.canVote || !data.options.length) {
		throw new Error('Already voted or invalid option');
	}

	await Vote.add(data);
	const pollData = await Poll.get(data.pollId, socket.uid, false);

	SocketIndex.server.sockets.emit('event:poll.voteChange', pollData);
};

Sockets.updateVote = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('You need to be logged in to make changes');
	}
	if (!data || isNaN(parseInt(data.pollId, 10)) || !data.options || !data.options.length) {
		throw new Error('Invalid vote');
	}
	data.uid = socket.uid;

	const result = await utils.promiseParallel({
		canUpdateVote: Vote.canUpdateVote(data.uid, data.pollId),
		optionsFilter: Poll.hasOptions(data.pollId, data.options),
		settings: Poll.getSettings(data.pollId),
	});

	// Filter the options on their existence
	data.options = data.options.filter((el, index) => result.optionsFilter[index]);

	// Give an error if there are too many votes
	if (data.options.length > parseInt(result.settings.maxvotes, 10)) {
		throw new Error(`You can only vote for ${result.settings.maxvotes} options on this poll.`);
	}
	if (!result.canUpdateVote) {
		throw new Error('Can\'t update vote');
	}
	if (!data.options.length) {
		throw new Error('Invalid option');
	}

	await Vote.update(data);
	const pollData = await Poll.get(data.pollId, socket.uid, false);

	SocketIndex.server.sockets.emit('event:poll.voteChange', pollData);
};

Sockets.removeVote = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('You need to be logged in to make changes');
	}
	if (!data || isNaN(parseInt(data.pollId, 10))) {
		throw new Error('Invalid request');
	}
	data.uid = socket.uid;

	const canUpdateVote = await Vote.canUpdateVote(data.uid, data.pollId);
	if (!canUpdateVote) {
		throw new Error('Can\'t remove vote');
	}

	await Vote.remove(data);
	const pollData = await Poll.get(data.pollId, socket.uid, false);

	SocketIndex.server.sockets.emit('event:poll.voteChange', pollData);
};

Sockets.getOptionDetails = async function (socket, data) {
	if (!socket.uid || !data || isNaN(parseInt(data.pollId, 10)) || isNaN(parseInt(data.optionId, 10))) {
		throw new Error('Invalid request');
	}

	const result = await Poll.getOption(data.pollId, data.optionId, true);
	if (!result.votes || !result.votes.length) {
		return result;
	}

	const userData = await User.getUsersFields(result.votes, ['uid', 'username', 'userslug', 'picture']);
	result.votes = userData;
	return result;
};

Sockets.canCreate = async function (socket, data) {
	if (!socket.uid || !data || (isNaN(parseInt(data.cid, 10)) && isNaN(parseInt(data.pid, 10)))) {
		throw new Error('Invalid request');
	}

	if (!data.cid) {
		const tid = await Posts.getPostField(data.pid, 'tid');
		const cid = await Topics.getTopicField(tid, 'cid');
		return checkPrivs(cid, socket.uid);
	}
	return await checkPrivs(data.cid, socket.uid);
};

async function checkPrivs(cid, socketUid) {
	const can = await Privileges.categories.can('poll:create', cid, socketUid);
	if (!can) {
		throw new Error(`[[poll:error.privilege.create, ${can}]]`);
	}
	return can;
}
