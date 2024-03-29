'use strict';

window.Poll = {};

(function () {
	window.Poll.alertError = function (message) {
		require(['alerts'], function (alerts) {
			alerts.error(message);
		});
	};

	require('poll/serializer')(window.utils);
	$(window).on('action:topic.loading', function () {
		if (ajaxify.data.posts.length > 0) {
			const post0 = ajaxify.data.posts[0];
			if (post0.pollData) {
				Poll.view.load(post0.pollData);
			} else if (post0.hasOwnProperty('pollId')) {
				getPoll(post0.pollId);
			}
		}
	});

	$(window).on('action:posts.edited', function (ev, data) {
		if (data.post.hasOwnProperty('pollId')) {
			getPoll(data.post.pollId);
		}
	});

	function getPoll(pollId) {
		pollId = parseInt(pollId, 10);

		if (!isNaN(pollId)) {
			Poll.sockets.getPoll({ pollId: pollId }, function (err, pollData) {
				if (err) {
					return Poll.alertError(err.message);
				}
				Poll.view.load(pollData);
			});
		}
	}
}());
