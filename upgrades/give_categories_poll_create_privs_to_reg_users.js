'use strict';

const async = require.main.require('async');
const db = require.main.require('./src/database');
const Privileges = require.main.require('./src/privileges');

module.exports = {
	name: 'Give all registered-users poll:create privileges on all categories',
	timestamp: Date.UTC(2019, 2, 8),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				console.error(err);
			}
			async.some(cids, (cid, next) => {
				// if any category already had a poll:create privilege, then this has ran before
				// todo: weak check?
				Privileges.categories.groupPrivileges(cid, 'registered-users', (err, privileges) => {
					if (err) {
						return next(err);
					}
					return next(null, !!privileges['poll:create']);
				});
			}, (err, result) => {
				if (err) {
					return callback(err);
				}
				// if true, then skip
				if (result) {
					return callback();
				}
				async.each(cids, (cid, next) => {
					Privileges.categories.give(['groups:poll:create'], cid, 'registered-users', next);
				}, callback);
			});
		});
	},
};
