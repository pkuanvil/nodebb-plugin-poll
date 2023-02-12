'use strict';

const db = require.main.require('./src/database');

const Poll = require('./poll');

const Vote = module.exports;

Vote.add = async function (voteData) {
	const { pollId, options, uid } = voteData;
	const timestamp = new Date().getTime();
	await Promise.all([
		...options.map(option => db.sortedSetAdd(`poll:${pollId}:options:${option}:votes`, timestamp, uid)),
		db.sortedSetAdd(`poll:${pollId}:voters`, timestamp, uid),
	]);
};

Vote.remove = async function (voteData, callback) {
	return await Vote.removeUidVote(voteData.uid, voteData.pollId, callback);
};

Vote.get = async function (voteData, callback) {
	return await Vote.getUidVote(voteData.uid, voteData.pollId, callback);
};

Vote.removeUidVote = async function (uid, pollId) {
	const vote = await Vote.getUidVote(uid, pollId);
	await Promise.all([
		...(vote.options || []).map(option => db.sortedSetRemove(`poll:${pollId}:options:${option}:votes`, uid)),
		db.sortedSetRemove(`poll:${pollId}:voters`, uid),
	]);
};

Vote.getUidVote = async function (uid, pollId) {
	const options = await Poll.getOptions(pollId, true);
	return {
		pollId: pollId,
		uid: uid,
		options: options
			.filter(option => option.votes.some(_uid => parseInt(_uid, 10) === parseInt(uid, 10)))
			.map(option => option.id),
	};
};

Vote.update = async function (voteData) {
	await Vote.remove(voteData);
	await Vote.add(voteData);
};

Vote.canUpdateVote = async function (uid, pollId) {
	const result = await Promise.all([
		Poll.hasEnded(pollId),
		Poll.isDeleted(pollId),
		Poll.doesDisallowVoteUpdate(pollId),
	]);
	return result.indexOf(true) === -1;
};

Vote.canVote = async function (uid, pollId) {
	const result = await Promise.all([
		Poll.hasEnded(pollId),
		Poll.isDeleted(pollId),
		Vote.hasUidVoted(uid, pollId),
	]);
	return result.indexOf(true) === -1;
};

Vote.hasUidVoted = async function (uid, pollId) {
	const score = await db.sortedSetScore(`poll:${pollId}:voters`, uid);
	return !!score;
};

Vote.hasUidVotedOnOption = async function (uid, pollId, option) {
	const score = await db.sortedSetScore(`poll:${pollId}:options:${option}:votes`, uid);
	return !!score;
};
