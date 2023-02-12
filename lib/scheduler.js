'use strict';

const cron = require.main.require('cron').CronJob;
const winston = require.main.require('winston');

const Poll = require('./poll');

const Scheduler = module.exports;

const jobs = new Map();

Scheduler.start = async function () {
	const PollIds = (await Poll.getScheduled()) || [];
	await Promise.all(PollIds.map(pollId => Scheduler.add(pollId)));
};

Scheduler.add = async function (pollId) {
	if (jobs.has(pollId)) {
		return;
	}

	const settings = await Poll.getSettings(pollId);

	if (!settings) {
		throw new Error(`[nodebb-plugin-poll/scheduler] Poll ID ${pollId} has no settings!`);
	}

	const now = Date.now();
	const end = parseInt(settings.end, 10);

	if (end < now) {
		await Scheduler.end(pollId);
	} else {
		const date = new Date(end);
		winston.verbose(`[nodebb-plugin-poll/scheduler] Starting scheduler for poll with ID ${pollId} to end on ${date}`);
		jobs.set(pollId, new cron(date, (() => Scheduler.end(pollId)), null, true));
	}
};

Scheduler.end = async function (pollId) {
	winston.verbose(`[nodebb-plugin-poll/scheduler] Ending poll with ID ${pollId}`);

	const job = jobs.get(pollId);
	if (job) {
		job.stop();
		jobs.delete(pollId);
	}

	await Poll.end(pollId);
};
