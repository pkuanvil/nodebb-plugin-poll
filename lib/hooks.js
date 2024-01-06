'use strict';

const Posts = require.main.require('./src/posts');
const Topics = require.main.require('./src/topics');
const Privileges = require.main.require('./src/privileges');

const Config = require('./config');
const Poll = require('./poll');
const Serializer = require('./serializer');
const Sockets = require('./sockets');

const Hooks = module.exports;

Hooks.filter = {};
Hooks.action = {};

Hooks.filter.parseRaw = async function (raw) {
	return Serializer.removeMarkup(raw, '[Poll]');
};

Hooks.filter.postCreate = async function (obj) {
	if (Serializer.hasMarkup(obj.post.content) && obj.data.isMain) {
		return await savePoll(obj);
	}
	return obj;
};

async function addPollData(post, callerUid) {
	post.pollData = await Sockets.get2(post.pollId, callerUid);
}

Hooks.filter.getPosts = async function (obj) {
	await Promise.all(
		obj.posts
			.filter(post => post.pollId)
			.map(post => addPollData(post, obj.uid))
	);
	return obj;
};

Hooks.filter.postEdit = async function (obj) {
	const { tid, pollId } = await Posts.getPostFields(obj.data.pid, ['tid', 'pollId']);
	if (pollId || !Serializer.hasMarkup(obj.post.content)) {
		return obj;
	}

	const result = await Topics.getTopicFields(tid, ['mainPid', 'cid']);
	if (parseInt(result.mainPid, 10) !== parseInt(obj.data.pid, 10)) {
		return obj;
	}

	await canCreate(result.cid, obj.post.editor);

	const postData = await savePoll({
		...obj.post,
		uid: obj.data.uid,
		pid: obj.data.pid,
		tid: tid,
	});
	delete postData.uid;
	delete postData.pid;
	delete postData.tid;
	obj.post = postData;

	if (!postData.pollId) {
		return obj;
	}

	// NodeBB only updates the edited, editor and content fields, so we add the pollId field manually.
	await Posts.setPostField(obj.data.pid, 'pollId', postData.pollId);
	return obj;
};

Hooks.filter.topicPost = async function (data) {
	if (Serializer.hasMarkup(data.content)) {
		await canCreate(data.cid, data.uid);
		return data;
	}
	return data;
};

// These 'restore' and 'delete' hooks are fired for all posts. Check whether the post have a poll first

Hooks.action.postDelete = async function (data) {
	const pollId = await Poll.getPollIdByPid(data.post.pid);
	if (pollId) {
		await Poll.delete(pollId);
	}
};

Hooks.action.postRestore = async function (data) {
	const pollId = await Poll.getPollIdByPid(data.post.pid);
	if (pollId) {
		await Poll.restore(pollId);
	}
};

Hooks.action.topicDelete = async function (data) {
	const pollId = await Poll.getPollIdByTid(data.topic.tid);
	if (pollId) {
		await Poll.delete(pollId);
	}
};

Hooks.action.topicRestore = async function (data) {
	const pollId = await Poll.getPollIdByTid(data.topic.tid);
	if (pollId) {
		await Poll.restore(pollId);
	}
};

async function canCreate(cid, uid) {
	const can = await Privileges.categories.can('poll:create', cid, uid);
	if (!can) {
		throw new Error('[[poll:error.privilege.create]]');
	}
}

async function savePoll(obj) {
	const postobj = obj.post ? obj.post : obj;
	const pollData = Serializer.serialize(postobj.content, await Config.settings.getObject());

	if (!pollData || !pollData.options.length) {
		return obj;
	}

	const pollId = await Poll.add(pollData, postobj);

	postobj.pollId = pollId;
	postobj.content = Serializer.removeMarkup(postobj.content);

	return obj;
}
